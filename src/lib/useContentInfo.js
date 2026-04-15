import { useQuery } from '@tanstack/react-query';
import { providerManager } from './services/ProviderManager';
import axios from 'axios';

export const useContentDetails = (link, providerValue) => {
  return useQuery({
    queryKey: ['contentInfo', link, providerValue],
    queryFn: async () => {
      if (!link || !providerValue) return null;
      console.log('[useContentDetails] Triggered for:', link);
      
      // 1. Scrape basic info from the piracy site
      const info = await providerManager.getMetaData({
        link: link,
        provider: providerValue, // We safely pass provider here, ProviderManager will catch it
      });

      if (!info) {
        throw new Error('Provider returned empty info.');
      }
      
      console.log("[useContentDetails] SUCCESS! Basic MetaData extracted.");

      // 2. Enrich with high-res Cinemeta data
      if (info.imdbId) {
        try {
          console.log(`[useContentDetails] Enriching with Cinemeta: ${info.imdbId}...`);
          const type = (info.type === 'series' || info.type === 'tv') ? 'series' : 'movie';
          const cinemetaRes = await axios.get(`https://v3-cinemeta.strem.io/meta/${type}/${info.imdbId}.json`);
          
          if (cinemetaRes.data && cinemetaRes.data.meta) {
            return { ...info, ...cinemetaRes.data.meta };
          }
        } catch (error) {
          console.warn('[useContentDetails] Cinemeta enrichment failed. Using basic info.');
        }
      }

      return info;
    },
    enabled: !!link && !!providerValue,
    staleTime: 10 * 60 * 1000, 
    retry: 0, // TURN OFF RETRIES! If it fails, let it crash immediately so we can see the real error!
  });
};