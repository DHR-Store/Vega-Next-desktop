import { useQuery } from '@tanstack/react-query';
import { providerManager } from '../services/ProviderManager';
import axios from 'axios';

const CINEMETA_API_URL = 'https://v3-cinemeta.strem.io/meta';

export const useContentInfo = (link, providerValue) => {
  return useQuery({
    queryKey: ['contentInfo', link, providerValue],
    queryFn: async () => {
      console.log('Fetching content info for:', link);
      const data = await providerManager.getMetaData({
        link,
        providerValue,
      });

      if (!data) {
        throw new Error('Error: No data returned from provider');
      }
      return data;
    },
    enabled: !!link && !!providerValue,
    staleTime: 10 * 60 * 1000,
    gcTime: 60 * 60 * 1000,
    retry: 1,
  });
};

export const useEnhancedMetadata = (imdbId, type) => {
  return useQuery({
    queryKey: ['enhancedMetadata', imdbId, type],
    queryFn: async () => {
      if (!imdbId || !type) return null;
      try {
        const response = await axios.get(`${CINEMETA_API_URL}/${type}/${imdbId}.json`, { timeout: 8000 });
        if (response.data && response.data.meta) {
          return response.data.meta;
        }
      } catch (err) {
        console.log("Cinemeta fetch failed", err);
      }
      return null;
    },
    enabled: !!imdbId && !!type,
    staleTime: 30 * 60 * 1000, 
    gcTime: 2 * 60 * 60 * 1000,
    retry: false, 
  });
};

export const useContentDetails = (link, providerValue) => {
  const {
    data: info,
    isLoading: infoLoading, // 🛠️ FIXED: We ONLY care if the primary provider is loading
    error: infoError,
    refetch: refetchInfo,
  } = useContentInfo(link, providerValue);

  const {
    data: meta,
  } = useEnhancedMetadata(info?.imdbId || '', info?.type || '');

  return {
    info,
    meta,
    isLoading: infoLoading, 
    error: infoError,
    refetch: refetchInfo,
  };
};