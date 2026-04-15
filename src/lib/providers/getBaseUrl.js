const expireTime = 60 * 60 * 1000; // 1 hour

export const getBaseUrl = async (providerValue) => {
  try {
    let baseUrl = '';
    const cacheKey = 'CacheBaseUrl_' + providerValue;
    const timeKey = 'baseUrlTime_' + providerValue;

    const cachedUrl = localStorage.getItem(cacheKey);
    const cachedTime = localStorage.getItem(timeKey);

    if (cachedUrl && cachedTime && Date.now() - parseInt(cachedTime) < expireTime) {
      baseUrl = cachedUrl;
    } else {
      const baseUrlRes = await fetch('https://DHR-Store.github.io/providers/modflix.json');
      const baseUrlData = await baseUrlRes.json();
      baseUrl = baseUrlData[providerValue]?.url || '';
      if (baseUrl) {
        localStorage.setItem(cacheKey, baseUrl);
        localStorage.setItem(timeKey, Date.now().toString());
      }
    }
    return baseUrl;
  } catch (error) {
    console.error(`Error fetching baseUrl: ${providerValue}`, error);
    return '';
  }
};