import { sleep } from '@steambrew/client';
import { EUIMode, type UIModeConfig } from '../types';
import { log } from '../services/logger';
import { getConfigForMode } from './selectors';

type ModeChangeCallback = (mode: EUIMode, doc: Document) => void;

let currentMode: EUIMode = EUIMode.Unknown;
let desktopDocument: Document | undefined;
let gamepadDocument: Document | undefined;
let modeChangeCallbacks: ModeChangeCallback[] = [];

// Document access helpers

function getDesktopDocument(): Document | undefined {
  // @ts-ignore - SteamUIStore is a global
  const windowStore = SteamUIStore?.WindowStore;
  return windowStore?.SteamUIWindows?.[0]?.m_BrowserWindow?.document;
}

function getGamepadDocument(): Document | undefined {
  // @ts-ignore - SteamUIStore is a global
  const windowStore = SteamUIStore?.WindowStore;
  const gamepadWindow = windowStore?.GamepadUIMainWindowInstance;
  return gamepadWindow?.m_BrowserWindow?.document || gamepadWindow?.BrowserWindow?.document;
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

  let attempts = 0;
  while (attempts < 30) {
    let doc: Document | undefined;

    if (mode === EUIMode.GamePad) {
      doc = getGamepadDocument();
    } else {
      // For desktop, try to find window with body ready
      // @ts-ignore
      const windows = SteamUIStore?.WindowStore?.SteamUIWindows || [];
      for (const win of windows) {
        const winDoc = win?.m_BrowserWindow?.document;
        if (winDoc?.body && win?.m_BrowserWindow?.name?.includes('Desktop')) {
          doc = winDoc;
          break;
        }
      }
      if (!doc && windows[0]) {
        doc = windows[0]?.m_BrowserWindow?.document;
      }
    }

    if (doc?.body) {
      log('fetchDocumentForMode:', mode === EUIMode.GamePad ? 'GamePad' : 'Desktop',
          'attempts:', attempts, 'found: true');
      return doc;
    }

    await sleep(250);
    attempts++;
  }

  log('fetchDocumentForMode:', mode === EUIMode.GamePad ? 'GamePad' : 'Desktop',
      'attempts:', attempts, 'found: false');
  return undefined;
}

// Mode detection

async function detectUIMode(): Promise<EUIMode> {
  try {
    // @ts-ignore - SteamClient is a global
    const mode = await SteamClient?.UI?.GetUIMode?.();
    if (mode !== undefined) {
      return mode as EUIMode;
    }
  } catch (e) {
    log('Failed to get UI mode from SteamClient:', e);
  }

  // Fallback: check which window instance exists
  // @ts-ignore
  const windowStore = SteamUIStore?.WindowStore;
  if (windowStore?.GamepadUIMainWindowInstance) {
    return EUIMode.GamePad;
  }
  if (windowStore?.SteamUIWindows?.length > 0) {
    return EUIMode.Desktop;
  }

  return EUIMode.Unknown;
}

// Public API

export function getCurrentMode(): EUIMode {
  return currentMode;
}

export function getCurrentConfig(): UIModeConfig {
  return getConfigForMode(currentMode);
}

export function getCurrentDocument(): Document | undefined {
  return currentMode === EUIMode.GamePad ? gamepadDocument : desktopDocument;
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

  if (currentMode === EUIMode.GamePad) {
    gamepadDocument = doc;
  } else {
    desktopDocument = doc;
  }

  return { mode: currentMode, document: doc };
}

export function registerModeChangeListener(): void {
  try {
    // @ts-ignore
    SteamClient?.UI?.RegisterForUIModeChanged?.(async (newMode: EUIMode) => {
      log('UI mode changed to:', newMode === EUIMode.GamePad ? 'Big Picture' : 'Desktop');
      const prevMode = currentMode;
      currentMode = newMode;

      if (prevMode !== newMode) {
        const doc = await fetchDocumentForMode(newMode);

        if (doc) {
          if (newMode === EUIMode.GamePad) {
            gamepadDocument = doc;
          } else {
            desktopDocument = doc;
          }

          log('Got new document for', newMode === EUIMode.GamePad ? 'Big Picture' : 'Desktop');
          modeChangeCallbacks.forEach((cb) => cb(newMode, doc));
        } else {
          log('Failed to get document for new mode');
        }
      }
    });
  } catch (e) {
    log('Could not register for mode changes:', e);
  }
}
