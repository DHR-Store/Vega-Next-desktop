import { useQuery } from '@tanstack/react-query';
import { getHomePageDataOptimized } from '../getHomepagedata';
import { cacheStorage } from '../storage';

export const useHomePageData = ({ provider, enabled = true }) => {
  return useQuery({
    queryKey: ['homePageData', provider?.value],
    queryFn: async ({ signal }) => {
      if (!provider?.value) return [];
      const data = await getHomePageDataOptimized(provider, signal);
      if (data && data.length > 0) {
        cacheStorage.setString('homeData' + provider.value, JSON.stringify(data));
      }
      return data;
    },
    enabled: enabled && !!provider?.value,
    staleTime: 2 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    initialData: () => {
      if (!provider?.value) return undefined;
      const cache = cacheStorage.getString('homeData' + provider.value);
      return cache ? JSON.parse(cache) : undefined;
    },
    initialDataUpdatedAt: 0,
  });
};

export const getRandomHeroPost = (homeData) => { /* unchanged */ };

export const useHeroMetadata = (heroLink, providerValue) => {
  return useQuery({
    queryKey: ['heroMetadata', heroLink, providerValue],
    queryFn: async () => {
      const { providerManager } = await import('../services/ProviderManager');
      const { default: axios } = await import('axios');

      // Use the same referer fallback for content info
      const { ipcRenderer } = window.require ? window.require('electron') : { invoke: async () => {} };
      const fetchWithTimeout = async (fn) => {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 10000);
        try { return await fn(); } finally { clearTimeout(timer); }
      };
      const withRefererFallback = async (fetchFn, refererUrl) => {
        let data = null;
        let token1 = null, token2 = null;
        try {
          if (ipcRenderer.invoke) token1 = await ipcRenderer.invoke('set-global-referer', refererUrl);
          data = await fetchWithTimeout(fetchFn);
          if (!data) throw new Error('Empty');
        } catch (err) {
          console.warn('First attempt failed:', err.message);
          data = null;
        } finally {
          if (ipcRenderer.invoke && token1 !== null) await ipcRenderer.invoke('clear-global-referer', token1);
        }
        if (!data) {
          try {
            if (ipcRenderer.invoke) token2 = await ipcRenderer.invoke('enable-auto-referer');
            data = await fetchWithTimeout(fetchFn);
            if (!data) throw new Error('Empty');
          } catch (err) {
            console.error('Auto-referer failed:', err);
            throw err;
          } finally {
            if (ipcRenderer.invoke && token2 !== null) await ipcRenderer.invoke('disable-auto-referer', token2);
          }
        }
        return data;
      };

      const info = await withRefererFallback(
        () => providerManager.getMetaData({ link: heroLink, provider: providerValue }),
        heroLink
      );

      let finalData = info;
      if (info.imdbId) {
        try {
          const response = await axios.get(
            `https://v3-cinemeta.strem.io/meta/${info.type}/${info.imdbId}.json`,
            { timeout: 5000 }
          );
          finalData = response.data?.meta || info;
        } catch { finalData = info; }
      }

      if (finalData) {
        cacheStorage.setString(heroLink, JSON.stringify(finalData));
      }
      return finalData;
    },
    enabled: !!heroLink && !!providerValue,
    staleTime: 1 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 2,
    initialData: () => {
      if (!heroLink) return undefined;
      const cached = cacheStorage.getString(heroLink);
      return cached ? JSON.parse(cached) : undefined;
    },
    initialDataUpdatedAt: 0,
  });
};