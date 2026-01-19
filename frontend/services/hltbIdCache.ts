/**
 * HLTB ID Cache
 *
 * Caches Steam app ID -> HLTB game ID mappings obtained from the HLTB Steam
 * import API. This allows direct HLTB lookups by ID, bypassing unreliable
 * name-based search.
 *
 * The cache is refreshed on every Steam startup (single low-cost API call).
 * This ensures new library additions get ID mappings immediately.
 *
 * Storage key: 'hltb-millennium-id-cache' in localStorage
 */

import { log, logError } from './logger';

interface IdCacheStore {
  [steamAppId: number]: number; // steamAppId -> hltbId
}

interface IdCacheMetadata {
  timestamp: number;
  steamUserId: string;
}

interface IdCacheData {
  mappings: IdCacheStore;
  metadata: IdCacheMetadata;
}

const CACHE_KEY = 'hltb-millennium-id-cache';

export function getHltbId(steamAppId: number): number | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const cache: IdCacheData = JSON.parse(raw);
    const hltbId = cache.mappings[steamAppId];

    return hltbId ?? null;
  } catch (e) {
    logError('ID cache read error:', e);
    return null;
  }
}

export function setIdCache(mappings: Array<{ steam_id: number; hltb_id: number }>, steamUserId: string): void {
  try {
    const store: IdCacheStore = {};
    for (const mapping of mappings) {
      store[mapping.steam_id] = mapping.hltb_id;
    }

    const cache: IdCacheData = {
      mappings: store,
      metadata: {
        timestamp: Date.now(),
        steamUserId,
      },
    };

    localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    log('ID cache updated with', mappings.length, 'mappings');
  } catch (e) {
    logError('ID cache write error:', e);
  }
}


export function clearIdCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
    log('ID cache cleared');
  } catch (e) {
    logError('ID cache clear error:', e);
  }
}

export function getIdCacheStats(): { count: number; steamUserId: string | null; ageMs: number | null } {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return { count: 0, steamUserId: null, ageMs: null };

    const cache: IdCacheData = JSON.parse(raw);
    const count = Object.keys(cache.mappings).length;
    const ageMs = Date.now() - cache.metadata.timestamp;

    return { count, steamUserId: cache.metadata.steamUserId, ageMs };
  } catch (e) {
    return { count: 0, steamUserId: null, ageMs: null };
  }
}
