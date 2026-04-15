import { useQuery } from '@tanstack/react-query';
import { providerManager } from '../services/ProviderManager';
import { cacheStorage } from '../storage';

// Helper to normalize episode data from any provider
const normalizeEpisodes = (raw) => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  // Handle { episodes: [...] } or { links: [...] } or { list: [...] }
  if (raw.episodes && Array.isArray(raw.episodes)) return raw.episodes;
  if (raw.links && Array.isArray(raw.links)) return raw.links;
  if (raw.list && Array.isArray(raw.list)) return raw.list;
  // If it's a single episode object, wrap it
  if (raw.link || raw.url || raw.href) return [raw];
  // Last resort: try to extract any array property
  const firstArrayProp = Object.values(raw).find(v => Array.isArray(v));
  return firstArrayProp || [];
};

export const useEpisodes = (episodesLink, providerValue, enabled = true) => {
  const query = useQuery({
    queryKey: ['episodes', episodesLink, providerValue],
    queryFn: async () => {
      if (!episodesLink || !providerValue || !enabled) {
        return [];
      }

      console.log('[useEpisodes] Fetching episodes for:', episodesLink);
      
      try {
        // ✅ FIX: Pass 'link' instead of 'url' (ProviderManager expects 'link')
        const rawEpisodes = await providerManager.getEpisodes({
          link: episodesLink,
          providerValue: providerValue,
        });

        const normalized = normalizeEpisodes(rawEpisodes);
        console.log(`[useEpisodes] Fetched ${normalized.length} episodes for ${episodesLink}`);

        if (normalized && normalized.length > 0) {
          cacheStorage.setString(episodesLink, JSON.stringify(normalized));
        } else {
          // Cache empty result to prevent repeated failing requests
          cacheStorage.setString(episodesLink, JSON.stringify([]));
        }

        return normalized;
      } catch (error) {
        console.error('[useEpisodes] Error fetching episodes:', error);
        // Return cached data if available
        const cached = cacheStorage.getString(episodesLink);
        if (cached) {
          try {
            return JSON.parse(cached);
          } catch (e) {
            return [];
          }
        }
        return [];
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

export const useStreamData = () => {
  const fetchStreams = async (link, type, providerValue) => {
    try {
      const stream = await providerManager.getStream({ link, type, providerValue });
      return Array.isArray(stream) ? stream : [stream];
    } catch (error) {
      console.error('Fetch stream error:', error);
      throw error;
    }
  };
  return { fetchStreams };
};