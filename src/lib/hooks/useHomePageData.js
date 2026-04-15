import { useQuery } from '@tanstack/react-query';
import { getHomePageData, HomePageData } from '../getHomepagedata';
import { cacheStorage } from '../storage';

/**
 * Hook to fetch and cache home page data with offline support
 */
export const useHomePageData = ({ provider, enabled = true }) => {
  return useQuery({
    queryKey: ['homePageData', provider?.value],
    queryFn: async ({ signal }) => {
      // Guard against null providers
      if (!provider?.value) return [];

      // 1. Fetch fresh data
      const data = await getHomePageData(provider, signal);

      // 2. Cache successful responses immediately inside the queryFn
      if (data && data.length > 0) {
        cacheStorage.setString(
          'homeData' + provider.value,
          JSON.stringify(data)
        );
      }

      return data;
    },
    enabled: enabled && !!provider?.value,
    staleTime: 2 * 60 * 1000, 
    gcTime: 30 * 60 * 1000, 
    retry: (failureCount, error) => {
      if (error.name === 'AbortError') {
        return false;
      }
      return failureCount < 3;
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

    initialData: () => {
      // 🛡️ BUG FIX: Don't attempt to load cache if provider is missing
      if (!provider?.value) return undefined; 

      const cache = cacheStorage.getString('homeData' + provider.value);
      if (cache) {
        try {
          return JSON.parse(cache);
        } catch {
          return undefined;
        }
      }
      return undefined;
    },

    // Tell React Query this initial data is old (stale) to trigger background refresh
    initialDataUpdatedAt: 0,
  });
};

/**
 * Helper to select a random post for the hero section
 */
export const getRandomHeroPost = (homeData) => {
  if (!homeData || homeData.length === 0) {
    return null;
  }

  const lastCategory = homeData[homeData.length - 1];
  if (!lastCategory.Posts || lastCategory.Posts.length === 0) {
    return null;
  }

  const randomIndex = Math.floor(Math.random() * lastCategory.Posts.length);
  return lastCategory.Posts[randomIndex];
};

/**
 * Hook for hero metadata with automatic Cinemeta/Stremio enrichment
 */
export const useHeroMetadata = (heroLink, providerValue) => {
  return useQuery({
    queryKey: ['heroMetadata', heroLink, providerValue],
    queryFn: async () => {
      const { providerManager } = await import('../services/ProviderManager');
      const { default: axios } = await import('axios');

      const info = await providerManager.getMetaData({
        link: heroLink,
        provider: providerValue,
      });

      let finalData = info;

      // Try to get enhanced metadata from Stremio if imdbId is available
      if (info.imdbId) {
        try {
          const response = await axios.get(
            `https://v3-cinemeta.strem.io/meta/${info.type}/${info.imdbId}.json`,
            { timeout: 5000 }
          );
          finalData = response.data?.meta || info;
        } catch {
          finalData = info; // Fallback to original info if Stremio fails
        }
      }

      // Cache hero metadata separately right after fetching
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
      // 🛡️ BUG FIX: Added guard
      if (!heroLink) return undefined; 

      const cached = cacheStorage.getString(heroLink);
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch {
          return undefined;
        }
      }
      return undefined;
    },

    initialDataUpdatedAt: 0,
  });
};