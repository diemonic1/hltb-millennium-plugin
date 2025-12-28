import type { UIModeConfig, GamePageInfo } from '../types';

export function detectGamePage(doc: Document, config: UIModeConfig): GamePageInfo | null {
  const headerImg = doc.querySelector(config.headerImageSelector) as HTMLImageElement | null;
  if (!headerImg) {
    return null;
  }

  const src = headerImg.src || '';
  const match = src.match(config.appIdPattern);
  if (!match) {
    return null;
  }

  const appId = parseInt(match[1], 10);

  const container = headerImg.closest(config.headerContainerSelector) as HTMLElement | null;
  if (!container) {
    return null;
  }

  return { appId, container };
}
