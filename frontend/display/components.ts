import type { HltbGameResult } from '../types';

const CONTAINER_ID = 'hltb-for-millennium';

function formatTime(hours: number | null): string {
  if (!hours || hours === 0) return '--';
  if (hours < 1) {
    const mins = Math.round(hours * 60);
    return `${mins}m`;
  }
  return `${hours}h`;
}

export function createLoadingDisplay(doc: Document): HTMLElement {
  const container = doc.createElement('div');
  container.id = CONTAINER_ID;

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

export function createDisplay(doc: Document, data: HltbGameResult): HTMLElement {
  const container = doc.createElement('div');
  container.id = CONTAINER_ID;

  const hltbUrl = `https://howlongtobeat.com/game/${data.game_id}`;

  const stats = [
    { value: data.comp_main, label: 'Main Story' },
    { value: data.comp_plus, label: 'Main + Extras' },
    { value: data.comp_100, label: 'Completionist' },
  ];

  const statsHtml = stats
    .filter(stat => stat.value && stat.value > 0)
    .map(stat => `
      <li>
        <p class="hltb-gametime">${formatTime(stat.value)}</p>
        <p class="hltb-label">${stat.label}</p>
      </li>`)
    .join('') + `
    <li>
      <button class="hltb-details-btn">View Details</button>
    </li>`;

  container.innerHTML = `
    <div class="hltb-info">
      <ul>${statsHtml}</ul>
    </div>
  `;

  const button = container.querySelector('.hltb-details-btn');
  button?.addEventListener('click', () => {
    window.open(`steam://openurl_external/${hltbUrl}`);
  });

  return container;
}

export function getExistingDisplay(doc: Document): HTMLElement | null {
  return doc.getElementById(CONTAINER_ID);
}

export function removeExistingDisplay(doc: Document): void {
  doc.getElementById(CONTAINER_ID)?.remove();
}
