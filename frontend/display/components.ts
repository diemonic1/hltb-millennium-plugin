import type { HltbGameResult } from '../types';
import type { PluginSettings } from '../services/settings';

const CONTAINER_ID = 'hltb-for-millennium';

function formatTime(hours: number | null | undefined): string {
  if (!hours || hours === 0) return '--';
  if (hours < 1) {
    const mins = Math.round(hours * 60);
    return `${mins}m`;
  }
  return `${hours}h`;
}

/**
 * Creates the HLTB display box.
 *
 * Display state is inferred from the `data` parameter:
 * - `undefined` → Loading (API call in progress, show "Loading...")
 * - `data` without `game_id` → Not found (show "Search HLTB" link)
 * - `data` with `game_id` → Found (show "View Details" button)
 */
export function createDisplay(
  doc: Document,
  settings: PluginSettings,
  data?: HltbGameResult
): HTMLElement {
  const container = doc.createElement('div');
  container.id = CONTAINER_ID;
  if (settings.horizontalOffset > 0) {
    container.style.right = `${settings.horizontalOffset}px`;
  }

  const stats = [
    { value: data?.comp_main, label: 'Main Story' },
    { value: data?.comp_plus, label: 'Main + Extras' },
    { value: data?.comp_100, label: 'Completionist' },
  ];

  const statsHtml = stats
    .map(stat => `
      <li>
        <p class="hltb-gametime">${formatTime(stat.value)}</p>
        <p class="hltb-label">${stat.label}</p>
      </li>`)
    .join('');

  // Determine action column content based on state
  let actionHtml = '';
  if (data === undefined) {
    // Loading state
    actionHtml = `<li><span class="hltb-status">Loading...</span></li>`;
  } else if (!data.game_id) {
    // Not found - show search link
    actionHtml = settings.showViewDetails
      ? `<li><button class="hltb-search-btn">Search HLTB</button></li>`
      : '';
  } else {
    // Found - show view details button
    actionHtml = settings.showViewDetails
      ? `<li><button class="hltb-details-btn">View Details</button></li>`
      : '';
  }

  container.innerHTML = `
    <div class="hltb-info">
      <ul>${statsHtml}${actionHtml}</ul>
    </div>
  `;

  // Attach click handlers
  if (data?.game_id && settings.showViewDetails) {
    const button = container.querySelector('.hltb-details-btn');
    button?.addEventListener('click', () => {
      window.open(`steam://openurl_external/https://howlongtobeat.com/game/${data.game_id}`);
    });
  } else if (data && !data.game_id && settings.showViewDetails) {
    const button = container.querySelector('.hltb-search-btn');
    button?.addEventListener('click', () => {
      const query = encodeURIComponent(data.searched_name);
      window.open(`steam://openurl_external/https://howlongtobeat.com/?q=${query}`);
    });
  }

  return container;
}

export function getExistingDisplay(doc: Document): HTMLElement | null {
  return doc.getElementById(CONTAINER_ID);
}

export function removeExistingDisplay(doc: Document): void {
  doc.getElementById(CONTAINER_ID)?.remove();
}
