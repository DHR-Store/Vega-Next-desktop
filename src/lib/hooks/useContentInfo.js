import { useQuery } from '@tanstack/react-query';
import { providerManager } from '../services/ProviderManager';

const { ipcRenderer } = window.require
  ? window.require('electron')
  : { invoke: async () => {} };

const STREAM_FETCH_TIMEOUT = 10000;

// Helper: fetch with timed controller (no abort signal passed to providerManager)
const fetchWithTimeout = async (fn, timeout = STREAM_FETCH_TIMEOUT) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    return await fn();
  } finally {
    clearTimeout(timer);
  }
};

// Reusable referer fallback logic
const withRefererFallback = async (fetchFn, refererUrl) => {
  let data = null;
  let refererToken = null;
  let autoRefererToken = null;

  // Attempt 1: global referer
  try {
    if (ipcRenderer.invoke) {
      refererToken = await ipcRenderer.invoke('set-global-referer', refererUrl);
    }
    data = await fetchWithTimeout(fetchFn);
    if (!data || (Array.isArray(data) && data.length === 0)) {
      throw new Error('Empty response');
    }
  } catch (err) {
    console.warn('First attempt failed, trying auto-referer:', err.message);
    data = null; // ensure fallback is triggered
  } finally {
    if (ipcRenderer.invoke && refererToken !== null) {
      await ipcRenderer.invoke('clear-global-referer', refererToken);
    }
  }

  // Attempt 2: auto-referer (only if first attempt yielded nothing or failed)
  if (!data || (Array.isArray(data) && data.length === 0)) {
    try {
      if (ipcRenderer.invoke) {
        autoRefererToken = await ipcRenderer.invoke('enable-auto-referer');
      }
      data = await fetchWithTimeout(fetchFn);
      if (!data || (Array.isArray(data) && data.length === 0)) {
        throw new Error('No data returned even with auto-referer');
      }
    } catch (err) {
      console.error('Auto-referer attempt failed:', err);
      throw err;
    } finally {
      if (ipcRenderer.invoke && autoRefererToken !== null) {
        await ipcRenderer.invoke('disable-auto-referer', autoRefererToken);
      }
    }
  }

  if (!data || (Array.isArray(data) && data.length === 0)) {
    throw new Error('No content info available');
  }
  return data;
};

export const useContentInfo = (link, providerValue) => {
  return useQuery({
    queryKey: ['contentInfo', link, providerValue],
    queryFn: async () => {
      console.log('Fetching content info for:', link);
      const data = await withRefererFallback(
        () => providerManager.getMetaData({ link, providerValue }),
        link   // use the series page as referer
      );
      if (!data) throw new Error('No data returned from provider');
      return data;
    },
    enabled: !!link && !!providerValue,
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });
};

export const useEnhancedMetadata = (imdbId, type) => {
  // No referer needed for Cinemeta
  return useQuery({
    queryKey: ['enhancedMetadata', imdbId, type],
    queryFn: async () => {
      if (!imdbId || !type) return null;
      try {
        const { default: axios } = await import('axios');
        const response = await axios.get(`https://v3-cinemeta.strem.io/meta/${type}/${imdbId}.json`, { timeout: 8000 });
        return response.data?.meta || null;
      } catch (err) {
        console.log("Cinemeta fetch failed", err);
        return null;
      }
    },
    enabled: !!imdbId && !!type,
    staleTime: 30 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    retry: false,
  });
};

export const useContentDetails = (link, providerValue) => {
  const { data: info, isLoading: infoLoading, error: infoError, refetch: refetchInfo } = useContentInfo(link, providerValue);
  const { data: meta } = useEnhancedMetadata(info?.imdbId || '', info?.type || '');
  return { info, meta, isLoading: infoLoading, error: infoError, refetch: refetchInfo };
};