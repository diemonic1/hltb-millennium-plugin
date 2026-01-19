import { callable } from '@steambrew/client';
import type { HltbGameResult, FetchResult } from '../types';
import { log, logError } from './logger';
import { getCache, setCache } from './cache';

interface BackendResponse {
  success: boolean;
  error?: string;
  data?: HltbGameResult;
}

const GetHltbData = callable<[{ app_id: number }], string>('GetHltbData');

async function fetchFromBackend(appId: number): Promise<HltbGameResult | null> {
  try {
    log('Calling backend for appId:', appId);
    const resultJson = await GetHltbData({ app_id: appId });

    if (resultJson === undefined || resultJson === null) {
      logError('Backend returned undefined/null for appId:', appId);
      return null;
    }

    const result: BackendResponse = JSON.parse(resultJson);
    log('Backend response:', result);

    if (!result.success) {
      log('Backend error:', result.error);
      return null;
    }

    // Data is always present on success (may or may not have game_id)
    if (result.data) {
      log('Caching data for appId:', appId, result.data);
      setCache(appId, result.data);
      return result.data;
    }

    log('No data in response for appId:', appId);
    return null;
  } catch (e) {
    logError('Backend call error for appId:', appId, e);
    return null;
  }
}

export async function fetchHltbData(appId: number): Promise<FetchResult> {
  const cached = getCache(appId);

  if (cached) {
    const cachedData = cached.entry.notFound ? null : cached.entry.data;
    const refreshPromise = cached.isStale ? fetchFromBackend(appId) : null;
    log('Cache hit:', appId, cached.isStale ? '(stale)' : '(fresh)');
    return { data: cachedData, fromCache: true, refreshPromise };
  }

  const data = await fetchFromBackend(appId);
  return { data, fromCache: false, refreshPromise: null };
}
