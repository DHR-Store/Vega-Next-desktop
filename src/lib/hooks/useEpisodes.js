import { useQuery } from '@tanstack/react-query';
import { providerManager } from '../services/ProviderManager';
import { cacheStorage } from '../storage';

const { ipcRenderer } = window.require
  ? window.require('electron')
  : { invoke: async () => {} };

const STREAM_FETCH_TIMEOUT = 15000;

const normalizeEpisodes = (raw) => { /* unchanged */ };

const fetchWithTimeout = async (fn) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STREAM_FETCH_TIMEOUT);
  try { return await fn(); } finally { clearTimeout(timer); }
};

const withRefererFallback = async (fetchFn, refererUrl) => {
  let data = null;
  let refererToken = null;
  let autoRefererToken = null;

  try {
    if (ipcRenderer.invoke) refererToken = await ipcRenderer.invoke('set-global-referer', refererUrl);
    data = await fetchWithTimeout(fetchFn);
    if (!data || (Array.isArray(data) && data.length === 0)) throw new Error('Empty');
  } catch (err) {
    console.warn('First attempt failed, trying auto-referer:', err.message);
    data = null;
  } finally {
    if (ipcRenderer.invoke && refererToken !== null) await ipcRenderer.invoke('clear-global-referer', refererToken);
  }

  if (!data || (Array.isArray(data) && data.length === 0)) {
    try {
      if (ipcRenderer.invoke) autoRefererToken = await ipcRenderer.invoke('enable-auto-referer');
      data = await fetchWithTimeout(fetchFn);
      if (!data || (Array.isArray(data) && data.length === 0)) throw new Error('No data');
    } catch (err) {
      console.error('Auto-referer failed:', err);
      throw err;
    } finally {
      if (ipcRenderer.invoke && autoRefererToken !== null) await ipcRenderer.invoke('disable-auto-referer', autoRefererToken);
    }
  }

  if (!data || (Array.isArray(data) && data.length === 0)) throw new Error('No episodes');
  return data;
};

export const useEpisodes = (episodesLink, providerValue, enabled = true) => {
  const query = useQuery({
    queryKey: ['episodes', episodesLink, providerValue],
    queryFn: async () => {
      if (!episodesLink || !providerValue || !enabled) return [];
      console.log('[useEpisodes] Fetching episodes for:', episodesLink);

      try {
        const rawEpisodes = await withRefererFallback(
          () => providerManager.getEpisodes({ link: episodesLink, providerValue }),
          episodesLink
        );
        const normalized = normalizeEpisodes(rawEpisodes);
        console.log(`[useEpisodes] Fetched ${normalized.length} episodes`);

        if (normalized.length > 0) {
          cacheStorage.setString(episodesLink, JSON.stringify(normalized));
        } else {
          cacheStorage.setString(episodesLink, JSON.stringify([]));
        }
        return normalized;
      } catch (error) {
        console.error('[useEpisodes] Error:', error);
        const cached = cacheStorage.getString(episodesLink);
        return cached ? JSON.parse(cached) : [];
      }
    },
    enabled: enabled && !!episodesLink && !!providerValue,
    staleTime: 15 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });

  return {
    ...query,
    isFetching: query.isFetching || (query.isLoading && query.fetchStatus !== 'idle'),
    data: query.data || [],
  };
};