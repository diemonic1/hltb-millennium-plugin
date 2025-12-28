import { Millennium } from '@steambrew/client';
import { fetchHltbData, formatTime, type HltbGameResult } from './services/hltbApi';
import {
  initUIMode,
  getCurrentConfig,
  getCurrentMode,
  registerModeChangeListener,
  onModeChange,
  logDOMStructure,
  EUIMode,
  type UIModeConfig,
} from './services/uiMode';

let steamDocument: Document | undefined;
let currentAppId: number | null = null;
let observer: MutationObserver | null = null;
let currentConfig: UIModeConfig;

function log(...args: unknown[]): void {
  console.log('[HLTB]', ...args);
}

// Styles matching hltb-for-deck
const HLTB_STYLES = `
#hltb-for-millennium {
  position: absolute;
  bottom: 0;
  right: 0;
  width: fit-content;
  z-index: 100;
}

.hltb-info {
  background: rgba(14, 20, 27, 0.85);
  border-top: 2px solid rgba(61, 68, 80, 0.54);
  padding: 8px 0;
}

.hltb-info ul {
  list-style: none;
  padding: 0 20px;
  margin: 0;
  display: flex;
  justify-content: space-evenly;
  align-items: center;
}

.hltb-info ul li {
  text-align: center;
  padding: 0 10px;
}

.hltb-info p {
  margin: 0;
  color: #ffffff;
}

.hltb-gametime {
  font-size: 16px;
  font-weight: bold;
}

.hltb-label {
  text-transform: uppercase;
  font-size: 10px;
  opacity: 0.7;
}

.hltb-details-btn {
  background: transparent;
  border: none;
  color: #1a9fff;
  font-size: 10px;
  font-weight: bold;
  text-transform: uppercase;
  cursor: pointer;
  padding: 5px 10px;
}

.hltb-details-btn:hover {
  color: #ffffff;
}
`;

function injectStyles(): void {
  if (!steamDocument || steamDocument.getElementById('hltb-styles')) return;
  const style = steamDocument.createElement('style');
  style.id = 'hltb-styles';
  style.textContent = HLTB_STYLES;
  steamDocument.head.appendChild(style);
}

function removeExisting(): void {
  steamDocument?.getElementById('hltb-for-millennium')?.remove();
}

function createLoadingDisplay(): HTMLElement {
  const container = steamDocument!.createElement('div');
  container.id = 'hltb-for-millennium';

  container.innerHTML = `
    <div class="hltb-info">
      <ul>
        <li>
          <p class="hltb-gametime">--</p>
          <p class="hltb-label">Main Story</p>
        </li>
        <li>
          <p class="hltb-gametime">--</p>
          <p class="hltb-label">Main + Extras</p>
        </li>
        <li>
          <p class="hltb-gametime">--</p>
          <p class="hltb-label">Completionist</p>
        </li>
      </ul>
    </div>
  `;

  return container;
}

function createDisplay(data: HltbGameResult): HTMLElement {
  const container = steamDocument!.createElement('div');
  container.id = 'hltb-for-millennium';

  const hltbUrl = `https://howlongtobeat.com/game/${data.game_id}`;

  let statsHtml = '';

  if (data.comp_main > 0) {
    statsHtml += `
      <li>
        <p class="hltb-gametime">${formatTime(data.comp_main)}</p>
        <p class="hltb-label">Main Story</p>
      </li>`;
  }

  if (data.comp_plus > 0) {
    statsHtml += `
      <li>
        <p class="hltb-gametime">${formatTime(data.comp_plus)}</p>
        <p class="hltb-label">Main + Extras</p>
      </li>`;
  }

  if (data.comp_100 > 0) {
    statsHtml += `
      <li>
        <p class="hltb-gametime">${formatTime(data.comp_100)}</p>
        <p class="hltb-label">Completionist</p>
      </li>`;
  }

  statsHtml += `
    <li>
      <button class="hltb-details-btn" onclick="window.open('steam://openurl_external/${hltbUrl}')">
        View Details
      </button>
    </li>`;

  container.innerHTML = `
    <div class="hltb-info">
      <ul>${statsHtml}</ul>
    </div>
  `;

  return container;
}

async function checkAndInject(): Promise<void> {
  if (!steamDocument || !currentConfig) return;

  // Find the header image element using current mode's selector
  const headerImg = steamDocument.querySelector(currentConfig.headerImageSelector) as HTMLImageElement | null;

  if (!headerImg) {
    // In Big Picture mode, log DOM structure periodically to help find selectors
    if (getCurrentMode() === EUIMode.GamePad) {
      // Only log occasionally to avoid spam
      if (Math.random() < 0.01) {
        log('Big Picture: Header image not found, use hltbDebug.logDOM() to inspect');
      }
    }
    return;
  }

  const src = headerImg.src || '';
  const match = src.match(currentConfig.appIdPattern);
  if (!match) {
    return;
  }

  const appId = parseInt(match[1], 10);

  if (appId === currentAppId) {
    return;
  }

  currentAppId = appId;
  log('Found game page for appId:', appId);
  removeExisting();

  const headerContainer = headerImg.closest(currentConfig.headerContainerSelector);
  if (!headerContainer) {
    log('Header container not found with selector:', currentConfig.headerContainerSelector);
    // Log DOM structure to help debug
    if (getCurrentMode() === EUIMode.GamePad) {
      logDOMStructure(steamDocument);
    }
    return;
  }

  // Show loading placeholder immediately
  (headerContainer as HTMLElement).style.position = 'relative';
  headerContainer.appendChild(createLoadingDisplay());

  try {
    const result = await fetchHltbData(appId);
    const existing = steamDocument?.getElementById('hltb-for-millennium');

    const updateDisplay = (data: typeof result.data) => {
      if (data && (data.comp_main > 0 || data.comp_plus > 0 || data.comp_100 > 0)) {
        if (existing) {
          existing.innerHTML = createDisplay(data).innerHTML;
        }
        return true;
      }
      return false;
    };

    updateDisplay(result.data);

    // Handle background refresh for stale data
    if (result.refreshPromise) {
      result.refreshPromise.then((newData) => {
        if (newData && currentAppId === appId) {
          updateDisplay(newData);
        }
      });
    }
  } catch (e) {
    log('Error fetching HLTB data:', e);
    // Keep placeholder on error
  }
}

function setupObserver(): void {
  if (!steamDocument) return;

  // Clean up existing observer
  if (observer) {
    observer.disconnect();
    observer = null;
  }

  observer = new MutationObserver(() => {
    checkAndInject();
  });

  observer.observe(steamDocument.body, {
    childList: true,
    subtree: true,
  });

  log('MutationObserver set up for', currentConfig.modeName, 'mode');

  // Initial check
  checkAndInject();
}

async function init(): Promise<void> {
  log('Initializing HLTB plugin...');

  try {
    // Initialize UI mode detection and get document
    const { mode, document } = await initUIMode();
    steamDocument = document;
    currentConfig = getCurrentConfig();

    log('Mode:', currentConfig.modeName);
    log('Using selectors:', {
      headerImage: currentConfig.headerImageSelector,
      headerContainer: currentConfig.headerContainerSelector,
    });

    // Inject styles and set up observer
    injectStyles();
    setupObserver();

    // Register for mode changes (for when user switches between Desktop and Big Picture)
    registerModeChangeListener();

    // Handle mode changes by reinitializing with new document
    onModeChange((newMode, newDoc) => {
      log('Reinitializing for mode change...');
      steamDocument = newDoc;
      currentConfig = getCurrentConfig();
      currentAppId = null; // Reset so we re-detect the current game

      // Re-inject styles and observer for new document
      injectStyles();
      setupObserver();

      log('Reinitialized for', currentConfig.modeName, 'mode');
    });

    // Log initial DOM structure in Big Picture mode to help find selectors
    if (mode === EUIMode.GamePad) {
      log('Big Picture mode detected. Use these console commands to find selectors:');
      log('  hltbDebug.logDOM()        - Log overall DOM structure');
      log('  hltbDebug.findImages()    - Find all images');
      log('  hltbDebug.findByClass(x)  - Find elements by class name');
      log('  hltbDebug.inspectElement(selector) - Inspect a specific element');

      // Wait a bit then log DOM structure automatically
      setTimeout(() => {
        log('Auto-logging DOM structure for Big Picture mode...');
        logDOMStructure(steamDocument!);
      }, 3000);
    }
  } catch (e) {
    log('Failed to initialize:', e);
  }
}

init();

export default async function PluginMain() {
  // Plugin initialization is handled by init()
}
