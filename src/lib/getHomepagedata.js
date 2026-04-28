import { providerManager } from './services/ProviderManager';
export const HomePageData = null;

const { ipcRenderer } = window.require
  ? window.require('electron')
  : { invoke: async () => {} };

const STREAM_FETCH_TIMEOUT = 15000;

const fetchWithTimeout = async (fn) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), STREAM_FETCH_TIMEOUT);
  try { return await fn(); } finally { clearTimeout(timer); }
};

const withRefererFallback = async (fetchFn, refererUrl) => {
  let data = null;
  let token1 = null, token2 = null;
  try {
    if (ipcRenderer.invoke) token1 = await ipcRenderer.invoke('set-global-referer', refererUrl);
    data = await fetchWithTimeout(fetchFn);
    if (!data || (Array.isArray(data) && data.length === 0)) throw new Error('Empty');
  } catch (err) {
    console.warn(`First attempt failed for ${refererUrl}:`, err.message);
    data = null;
  } finally {
    if (ipcRenderer.invoke && token1 !== null) await ipcRenderer.invoke('clear-global-referer', token1);
  }

  if (!data || (Array.isArray(data) && data.length === 0)) {
    try {
      if (ipcRenderer.invoke) token2 = await ipcRenderer.invoke('enable-auto-referer');
      data = await fetchWithTimeout(fetchFn);
      if (!data || (Array.isArray(data) && data.length === 0)) throw new Error('Empty');
    } catch (err) {
      console.error('Auto-referer failed:', err);
      throw err;
    } finally {
      if (ipcRenderer.invoke && token2 !== null) await ipcRenderer.invoke('disable-auto-referer', token2);
    }
  }

  return data;
};

export const getHomePageDataOptimized = async (activeProvider, signal) => {
  console.log('Fetching data for provider:', activeProvider.display_name);

  try {
    const catalogs = await withRefererFallback(
      () => providerManager.getCatalog({ providerValue: activeProvider.value }),
      activeProvider.homeUrl || activeProvider.value  // fallback to provider value
    );

    if (!catalogs || !Array.isArray(catalogs)) {
      console.warn('No catalogs returned');
      return [];
    }

    const fetchPromises = catalogs.map(async (item) => {
      try {
        // For each posts request, use the provider's home URL as referer
        const posts = await withRefererFallback(
          () => providerManager.getPosts({
            filter: item.filter,
            page: 1,
            providerValue: activeProvider.value,
            signal,
          }),
          activeProvider.homeUrl || activeProvider.value
        );

        if (signal?.aborted) throw new Error('Request aborted');
        console.log(`✅ Fetched ${posts?.length || 0} posts for: ${item.title}`);
        return { title: item.title, Posts: posts || [], filter: item.filter };
      } catch (error) {
        console.error(`❌ Failed to fetch ${item.title}:`, error);
        return { title: item.title, Posts: [], filter: item.filter, error: error.message };
      }
    });

    const results = await Promise.allSettled(fetchPromises);
    const homePageData = results.map((result, index) => {
      if (result.status === 'fulfilled') return result.value;
      return {
        title: catalogs[index]?.title || 'Unknown',
        Posts: [],
        filter: catalogs[index]?.filter || '',
        error: result.reason?.message || 'Failed to load',
      };
    });
    return homePageData;
  } catch (error) {
    console.error('Critical Error fetching home page data:', error);
    throw error;
  }
};

export const getHomePageData = getHomePageDataOptimized;