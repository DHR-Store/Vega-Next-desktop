import { useQuery } from '@tanstack/react-query';
import { providerManager } from './services/ProviderManager';

export const useEpisodes = (episodesLink, providerValue) => {
  return useQuery({
    queryKey: ['episodes', episodesLink, providerValue],
    queryFn: async () => {
      if (!episodesLink || !providerValue) return [];
      console.log('[useEpisodes] Fetching episodes for:', episodesLink);
      
      const episodes = await providerManager.getEpisodes({
        url: episodesLink,
        providerValue: providerValue, // Pass it explicitly
      });

      console.log(`[useEpisodes] Found ${episodes?.length || 0} episodes.`);
      return episodes || [];
    },
    enabled: !!episodesLink && !!providerValue,
    staleTime: 15 * 60 * 1000,
    retry: 1, // Optional: Let it retry once if it hits a momentary network hiccup
  });
};

export const getStreamData = async (link, providerValue) => {
  try {
    const stream = await providerManager.getStream({
      link: link,
      providerValue: providerValue,
    });
    
    // Normalize response formats
    if (Array.isArray(stream)) return { links: stream };
    if (stream?.links) return stream;
    
    return { links: [] };
  } catch (error) {
    console.error("[getStreamData] Stream Fetch Error:", error);
    return { links: [] };
  }
};