import type { UIModeConfig } from '../types';
import { log } from '../services/logger';
import { fetchHltbData } from '../services/hltbApi';
import { detectGamePage } from './detector';
import {
  createLoadingDisplay,
  createDisplay,
  getExistingDisplay,
  removeExistingDisplay,
} from '../display/components';
import { injectStyles } from '../display/styles';

let currentAppId: number | null = null;
let observer: MutationObserver | null = null;

export function resetState(): void {
  currentAppId = null;
}

export function getCurrentAppId(): number | null {
  return currentAppId;
}

async function handleGamePage(doc: Document, config: UIModeConfig): Promise<void> {
  const gamePage = detectGamePage(doc, config);
  if (!gamePage) {
    return;
  }

  const { appId, container } = gamePage;

  // Already showing for this app
  if (appId === currentAppId) {
    return;
  }

  currentAppId = appId;
  log('Found game page for appId:', appId);

  removeExistingDisplay(doc);

  // Ensure container has relative positioning for absolute child
  container.style.position = 'relative';
  container.appendChild(createLoadingDisplay(doc));

  try {
    const result = await fetchHltbData(appId);
    const existing = getExistingDisplay(doc);

    const updateDisplay = (data: typeof result.data) => {
      if (data && (data.comp_main > 0 || data.comp_plus > 0 || data.comp_100 > 0)) {
        if (existing) {
          existing.innerHTML = createDisplay(doc, data).innerHTML;
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
  }
}

export function setupObserver(doc: Document, config: UIModeConfig): void {
  // Clean up existing observer
  if (observer) {
    observer.disconnect();
    observer = null;
  }

  injectStyles(doc);

  observer = new MutationObserver(() => {
    handleGamePage(doc, config);
  });

  observer.observe(doc.body, {
    childList: true,
    subtree: true,
  });

  log('MutationObserver set up for', config.modeName, 'mode');

  // Initial check
  handleGamePage(doc, config);
}

export function disconnectObserver(): void {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}
