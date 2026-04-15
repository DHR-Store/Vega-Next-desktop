import { providerManager } from './services/ProviderManager';

export const getStreamData = async (link, providerValue) => {
  try {
    const stream = await providerManager.getStream({
      link: link,
      providerValue: providerValue,
    });
    
    // Normalize response in case providers return different structures
    if (Array.isArray(stream)) return { links: stream };
    if (stream?.links) return stream;
    
    return { links: [] };
  } catch (error) {
    console.error("[getStreamData] Stream Fetch Error:", error);
    return { links: [] };
  }
};