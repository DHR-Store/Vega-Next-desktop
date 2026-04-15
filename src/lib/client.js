import { QueryClient } from '@tanstack/react-query';

// Enhanced query client with optimal configurations for Web
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error.name === 'AbortError') return false;
        if (error.message?.includes('4')) return false; // 4xx errors
        return failureCount < 3;
      },
      retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
      staleTime: 5 * 60 * 1000, 
      gcTime: 30 * 60 * 1000, 
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always',
      refetchOnMount: true,
      refetchInterval: false,
      notifyOnChangeProps: 'all',
    },
  },
});

export const queryClientUtils = {
  getCacheStats: () => {
    const queryCache = queryClient.getQueryCache();
    const queries = queryCache.getAll();

    return {
      totalQueries: queries.length,
      freshQueries: queries.filter(q => q.isStale() === false).length,
      staleQueries: queries.filter(q => q.isStale() === true).length,
      loadingQueries: queries.filter(q => q.state.fetchStatus === 'fetching').length,
      errorQueries: queries.filter(q => q.state.status === 'error').length,
    };
  },

  clearCache: (patterns) => {
    patterns.forEach(pattern => {
      queryClient.removeQueries({ queryKey: [pattern] });
    });
  },

  prefetchCommonData: async (providerValue) => {
    await queryClient.prefetchQuery({
      queryKey: ['catalog', providerValue],
      queryFn: async () => {
        const { providerManager } = await import('./services/ProviderManager');
        return providerManager.getCatalog({ providerValue });
      },
      staleTime: 10 * 60 * 1000,
    });
  },

  setOptimisticData: (queryKey, updater) => {
    queryClient.setQueryData(queryKey, updater);
  },
};