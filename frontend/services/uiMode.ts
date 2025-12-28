import { sleep } from '@steambrew/client';

// UI Mode enum matching Steam's internal values
export enum EUIMode {
  Unknown = -1,
  GamePad = 4, // Big Picture / Steam Deck
  Desktop = 7,
}

// Selector configuration for each UI mode
export interface UIModeConfig {
  mode: EUIMode;
  modeName: string;
  headerImageSelector: string;
  headerContainerSelector: string;
  appIdPattern: RegExp;
}

// Desktop mode selectors (confirmed working)
const DESKTOP_CONFIG: UIModeConfig = {
  mode: EUIMode.Desktop,
  modeName: 'Desktop',
  headerImageSelector: '._3NBxSLAZLbbbnul8KfDFjw._2dzwXkCVAuZGFC-qKgo8XB',
  headerContainerSelector: '._2aPcBP45fdgOK22RN0jbhm',
  appIdPattern: /\/assets\/(\d+)/,
};

// Big Picture mode selectors (same as desktop - they share the same classes)
const GAMEPAD_CONFIG: UIModeConfig = {
  mode: EUIMode.GamePad,
  modeName: 'Big Picture',
  // Same selectors as desktop - Steam uses identical classes in both modes
  headerImageSelector: '._3NBxSLAZLbbbnul8KfDFjw._2dzwXkCVAuZGFC-qKgo8XB',
  headerContainerSelector: '._2aPcBP45fdgOK22RN0jbhm',
  appIdPattern: /\/assets\/(\d+)/,
};

let currentMode: EUIMode = EUIMode.Unknown;
let desktopDocument: Document | undefined;
let gamepadDocument: Document | undefined;
let modeChangeCallbacks: Array<(mode: EUIMode, doc: Document) => void> = [];

/**
 * Get the current UI mode
 */
export function getCurrentMode(): EUIMode {
  return currentMode;
}

/**
 * Get the config for the current UI mode
 */
export function getCurrentConfig(): UIModeConfig {
  return currentMode === EUIMode.GamePad ? GAMEPAD_CONFIG : DESKTOP_CONFIG;
}

/**
 * Get the document for the current UI mode
 */
export function getCurrentDocument(): Document | undefined {
  return currentMode === EUIMode.GamePad ? gamepadDocument : desktopDocument;
}

/**
 * Register a callback for UI mode changes
 */
export function onModeChange(callback: (mode: EUIMode, doc: Document) => void): () => void {
  modeChangeCallbacks.push(callback);
  return () => {
    modeChangeCallbacks = modeChangeCallbacks.filter((cb) => cb !== callback);
  };
}

/**
 * Log helper for HLTB debugging
 */
function log(...args: unknown[]): void {
  console.log('[HLTB]', ...args);
}

/**
 * Detect the current UI mode from SteamClient
 */
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

/**
 * Get the document for desktop mode
 */
async function getDesktopDocument(): Promise<Document | undefined> {
  // @ts-ignore
  const windowStore = SteamUIStore?.WindowStore;
  const desktopWindow = windowStore?.SteamUIWindows?.[0];
  return desktopWindow?.m_BrowserWindow?.document;
}

/**
 * Get the document for gamepad/Big Picture mode
 */
async function getGamepadDocument(): Promise<Document | undefined> {
  // @ts-ignore
  const windowStore = SteamUIStore?.WindowStore;
  const gamepadWindow = windowStore?.GamepadUIMainWindowInstance;
  return gamepadWindow?.m_BrowserWindow?.document || gamepadWindow?.BrowserWindow?.document;
}

/**
 * Log DOM structure for debugging Big Picture selectors
 */
export function logDOMStructure(doc: Document, selector?: string): void {
  log('=== DOM Structure Debug ===');
  log('Mode:', currentMode === EUIMode.GamePad ? 'Big Picture' : 'Desktop');
  log('Document title:', doc.title);
  log('Body classes:', doc.body?.className);

  if (selector) {
    const elements = doc.querySelectorAll(selector);
    log(`Found ${elements.length} elements matching "${selector}"`);
    elements.forEach((el, i) => {
      log(`  [${i}]`, el.tagName, el.className, el.id);
    });
  }

  // Log some common game page elements to help find selectors
  const images = doc.querySelectorAll('img[src*="/assets/"]');
  log(`Found ${images.length} images with /assets/ in src`);
  images.forEach((img, i) => {
    const imgEl = img as HTMLImageElement;
    log(`  [${i}] src: ${imgEl.src}`);
    log(`       class: ${imgEl.className}`);
    log(`       parent classes:`, imgEl.parentElement?.className);
    // Log ancestor chain (up to 5 levels)
    let parent = imgEl.parentElement;
    for (let level = 1; level <= 5 && parent; level++) {
      log(`       ancestor ${level}: ${parent.tagName}.${parent.className.split(' ')[0] || '(no class)'}`);
      parent = parent.parentElement;
    }
  });

  log('=== End DOM Debug ===');
}

/**
 * Expose debugging functions to window for manual console use
 */
function exposeDebugFunctions(doc: Document): void {
  const debugObj = {
    logDOM: (selector?: string) => logDOMStructure(doc, selector),
    getMode: () => (currentMode === EUIMode.GamePad ? 'Big Picture' : 'Desktop'),
    getConfig: () => getCurrentConfig(),
    findImages: () => {
      const images = doc.querySelectorAll('img');
      images.forEach((img, i) => {
        log(`[${i}] ${(img as HTMLImageElement).src} - class: ${img.className}`);
      });
    },
    findByClass: (className: string) => {
      const elements = doc.querySelectorAll(`.${className}`);
      log(`Found ${elements.length} elements with class "${className}"`);
      elements.forEach((el, i) => {
        log(`  [${i}]`, el.tagName, el.className);
      });
    },
    inspectElement: (selector: string) => {
      const el = doc.querySelector(selector);
      if (!el) {
        log('No element found for selector:', selector);
        return;
      }
      log('Element:', el.tagName);
      log('Classes:', el.className);
      log('ID:', el.id);
      log('Children:', el.children.length);
      Array.from(el.children).forEach((child, i) => {
        log(`  [${i}] ${child.tagName}.${child.className.split(' ')[0] || '(no class)'}`);
      });
    },
  };

  // Expose to both the Steam UI window and global window
  // @ts-ignore
  doc.defaultView.hltbDebug = debugObj;
  // @ts-ignore - Also expose globally for dev console access
  globalThis.hltbDebug = debugObj;

  log('Debug functions exposed. Use hltbDebug.logDOM(), hltbDebug.findImages(), etc.');
}

/**
 * Initialize UI mode detection and document access
 * Uses the same robust waiting pattern as the original code
 */
export async function initUIMode(): Promise<{ mode: EUIMode; document: Document }> {
  log('Initializing UI mode detection...');

  let doc: Document | undefined;

  // Wait for document to be available (same pattern as original code)
  // Try both desktop and gamepad window sources
  while (!doc) {
    // @ts-ignore
    const windowStore = SteamUIStore?.WindowStore;

    // Try desktop first (most common)
    doc = windowStore?.SteamUIWindows?.[0]?.m_BrowserWindow?.document;

    // If not found, try gamepad/Big Picture
    if (!doc) {
      const gamepadWindow = windowStore?.GamepadUIMainWindowInstance;
      doc = gamepadWindow?.m_BrowserWindow?.document || gamepadWindow?.BrowserWindow?.document;
    }

    if (!doc) {
      await sleep(500);
    }
  }

  log('Got document, detecting mode...');

  // Now detect mode
  currentMode = await detectUIMode();
  log('Detected UI mode:', currentMode === EUIMode.GamePad ? 'Big Picture' : 'Desktop');

  // Store in appropriate variable
  if (currentMode === EUIMode.GamePad) {
    gamepadDocument = doc;
  } else {
    desktopDocument = doc;
  }

  exposeDebugFunctions(doc);
  return { mode: currentMode, document: doc };
}

/**
 * Fetch fresh document for the current mode
 */
async function fetchDocumentForMode(mode: EUIMode): Promise<Document | undefined> {
  let doc: Document | undefined;
  let attempts = 0;

  // Wait a bit for the mode transition to complete
  await sleep(500);

  while (!doc && attempts < 30) {
    // @ts-ignore
    const windowStore = SteamUIStore?.WindowStore;

    if (mode === EUIMode.GamePad) {
      const gamepadWindow = windowStore?.GamepadUIMainWindowInstance;
      doc = gamepadWindow?.m_BrowserWindow?.document || gamepadWindow?.BrowserWindow?.document;
    } else {
      // For desktop, try to find the right window
      const windows = windowStore?.SteamUIWindows || [];
      for (const win of windows) {
        const winDoc = win?.m_BrowserWindow?.document;
        // Make sure the document has a body and is the library window
        if (winDoc?.body && win?.m_BrowserWindow?.name?.includes('Desktop')) {
          doc = winDoc;
          break;
        }
      }
      // Fallback to first window if no Desktop window found
      if (!doc && windows[0]) {
        doc = windows[0]?.m_BrowserWindow?.document;
      }
    }

    // Ensure document has a body before considering it valid
    if (!doc?.body) {
      doc = undefined;
      await sleep(250);
      attempts++;
    }
  }

  log('fetchDocumentForMode:', mode === EUIMode.GamePad ? 'GamePad' : 'Desktop',
      'attempts:', attempts, 'found:', !!doc);

  return doc;
}

/**
 * Register for UI mode changes (if supported)
 */
export function registerModeChangeListener(): void {
  try {
    // @ts-ignore
    SteamClient?.UI?.RegisterForUIModeChanged?.(async (newMode: EUIMode) => {
      log('UI mode changed to:', newMode === EUIMode.GamePad ? 'Big Picture' : 'Desktop');
      const prevMode = currentMode;
      currentMode = newMode;

      if (prevMode !== newMode) {
        // Fetch the new document for the new mode
        const doc = await fetchDocumentForMode(newMode);

        if (doc) {
          // Update cached document
          if (newMode === EUIMode.GamePad) {
            gamepadDocument = doc;
          } else {
            desktopDocument = doc;
          }

          exposeDebugFunctions(doc);
          log('Got new document for', newMode === EUIMode.GamePad ? 'Big Picture' : 'Desktop');

          // Notify callbacks
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
