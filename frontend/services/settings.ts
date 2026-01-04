export interface PluginSettings {
  horizontalOffset: number;
  showViewDetails: boolean;
  alignRight: boolean;
}

const STORAGE_KEY = 'hltb-millennium-settings';

const DEFAULT_SETTINGS: PluginSettings = {
  horizontalOffset: 0,
  showViewDetails: true,
  alignRight: true,
};

export function getSettings(): PluginSettings {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return { ...DEFAULT_SETTINGS };

    const parsed = JSON.parse(stored);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
    };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings: PluginSettings): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
