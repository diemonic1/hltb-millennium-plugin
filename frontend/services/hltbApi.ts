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

    if (!result.success || !result.data) {
      log('Backend error:', result.error);
      return null;
    }

    setCache(appId, result.data);
    return result.data;
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
    return { data: cachedData, fromCache: true, refreshPromise };
  }

  const data = await fetchFromBackend(appId);
  if (!data) {
    setCache(appId, null);
  }
  return { data, fromCache: false, refreshPromise: null };
}
