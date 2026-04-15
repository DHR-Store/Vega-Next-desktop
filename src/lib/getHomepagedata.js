import { providerManager } from './services/ProviderManager';

// Dummy export to prevent Vite crashes from old TypeScript imports
export const HomePageData = null;

export const getHomePageDataOptimized = async (activeProvider, signal) => {
  console.log('Fetching data for provider:', activeProvider.display_name);

  try {
    // 🐞 THE BUG WAS HERE: Added the missing "await" keyword
    const catalogs = await providerManager.getCatalog({
      providerValue: activeProvider.value,
    });

    // Fallback if the provider's catalog is empty or broken
    if (!catalogs || !Array.isArray(catalogs)) {
      console.warn('No catalogs returned from provider');
      return [];
    }

    const fetchPromises = catalogs.map(async (item) => {
      try {
        const data = await providerManager.getPosts({
          filter: item.filter,
          page: 1,
          providerValue: activeProvider.value,
          signal,
        });

        if (signal && signal.aborted) {
          throw new Error('Request aborted');
        }

        console.log(`✅ Fetched ${data?.length || 0} posts for: ${item.title}`);

        return {
          title: item.title,
          Posts: data || [],
          filter: item.filter,
        };
      } catch (error) {
        console.error(`❌ Failed to fetch ${item.title}:`, error);
        return {
          title: item.title,
          Posts: [],
          filter: item.filter,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });

    const results = await Promise.allSettled(fetchPromises);

    const homePageData = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        homePageData.push(result.value);
      } else {
        homePageData.push({
          title: catalogs[index]?.title || 'Unknown',
          Posts: [],
          filter: catalogs[index]?.filter || '',
          error: result.reason?.message || 'Failed to load',
        });
      }
    });

    return homePageData;
  } catch (error) {
    console.error('Critical Error fetching home page data:', error);
    throw error;
  }
};

export const getHomePageData = getHomePageDataOptimized;