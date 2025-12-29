import { sleep } from '@steambrew/client';
import { EUIMode, type UIModeConfig } from '../types';
import { log } from '../services/logger';
import { getConfigForMode } from './selectors';

const MAX_RETRIES = 20;
const RETRY_DELAY_MS = 250;

type ModeChangeCallback = (mode: EUIMode, doc: Document) => void;

let currentMode: EUIMode = EUIMode.Unknown;
let currentDocument: Document | undefined;
let modeChangeCallbacks: ModeChangeCallback[] = [];

// Document access helpers

function getDesktopDocument(): Document | undefined {
  // @ts-ignore - SteamUIStore is a global
  return SteamUIStore?.WindowStore?.MainWindowInstance?.BrowserWindow?.document;
}

function getGamepadDocument(): Document | undefined {
  // @ts-ignore - SteamUIStore is a global
  return SteamUIStore?.WindowStore?.GamepadUIMainWindowInstance?.BrowserWindow?.document;
}

async function waitForDocument(): Promise<Document> {
  let doc: Document | undefined;

  while (!doc) {
    doc = getDesktopDocument() || getGamepadDocument();
    if (!doc) {
      await sleep(500);
    }
  }

  return doc;
}

async function fetchDocumentForMode(mode: EUIMode): Promise<Document | undefined> {
  // Wait for mode transition to complete
  await sleep(500);

  const modeName = mode === EUIMode.GamePad ? 'GamePad' : 'Desktop';

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    let doc: Document | undefined;

    if (mode === EUIMode.GamePad) {
      doc = getGamepadDocument();
    } else {
      // For desktop, try to find window with body ready
      // @ts-ignore
      const windows = SteamUIStore?.WindowStore?.SteamUIWindows || [];
      for (const win of windows) {
        const winDoc = win?.BrowserWindow?.document;
        if (winDoc?.body && win?.BrowserWindow?.name?.includes('Desktop')) {
          doc = winDoc;
          break;
        }
      }
      if (!doc && windows[0]) {
        doc = windows[0]?.BrowserWindow?.document;
      }
    }

    if (doc?.body) {
      log('fetchDocumentForMode:', modeName, 'found on attempt', attempt, 'of', MAX_RETRIES);
      return doc;
    }

    await sleep(RETRY_DELAY_MS);
  }

  log('fetchDocumentForMode:', modeName, 'not found after', MAX_RETRIES, 'attempts');
  return undefined;
}

// Mode detection

async function detectUIMode(): Promise<EUIMode> {
  // @ts-ignore - SteamClient is a global
  return (await SteamClient.UI.GetUIMode()) as EUIMode;
}

// Public API

export function getCurrentMode(): EUIMode {
  return currentMode;
}

export function getCurrentConfig(): UIModeConfig {
  return getConfigForMode(currentMode);
}

export function getCurrentDocument(): Document | undefined {
  return currentDocument;
}

export function onModeChange(callback: ModeChangeCallback): () => void {
  modeChangeCallbacks.push(callback);
  return () => {
    modeChangeCallbacks = modeChangeCallbacks.filter((cb) => cb !== callback);
  };
}

export async function initUIMode(): Promise<{ mode: EUIMode; document: Document }> {
  log('Initializing UI mode detection...');

  const doc = await waitForDocument();
  log('Got document, detecting mode...');

  currentMode = await detectUIMode();
  log('Detected UI mode:', currentMode === EUIMode.GamePad ? 'Big Picture' : 'Desktop');

  currentDocument = doc;

  return { mode: currentMode, document: doc };
}

export function registerModeChangeListener(): void {
  // @ts-ignore
  SteamClient?.UI?.RegisterForUIModeChanged?.(async (newMode: EUIMode) => {
    log('UI mode changed to:', newMode === EUIMode.GamePad ? 'Big Picture' : 'Desktop');
    currentMode = newMode;

    const doc = await fetchDocumentForMode(newMode);
    log('fetchDocumentForMode returned:', doc ? 'found' : 'not found');

    if (doc) {
      currentDocument = doc;
      modeChangeCallbacks.forEach((cb) => cb(newMode, doc));
    }
  });
}
