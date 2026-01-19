/**
 * HLTB ID Cache
 *
 * Caches Steam app ID -> HLTB game ID mappings obtained from the HLTB Steam
 * import API. This allows direct HLTB lookups by ID, bypassing unreliable
 * name-based search.
 *
 * The cache is populated at startup if the user's Steam profile is public.
 * Mappings are stored per-user and expire after 7 days.
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
const CACHE_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days

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

export function isIdCacheValid(steamUserId: string): boolean {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return false;

    const cache: IdCacheData = JSON.parse(raw);

    // Check if same user
    if (cache.metadata.steamUserId !== steamUserId) {
      log('ID cache user mismatch, needs refresh');
      return false;
    }

    // Check if not expired
    const age = Date.now() - cache.metadata.timestamp;
    if (age > CACHE_DURATION) {
      log('ID cache expired, needs refresh');
      return false;
    }

    return true;
  } catch (e) {
    return false;
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
