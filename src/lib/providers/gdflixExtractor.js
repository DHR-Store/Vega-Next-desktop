import { headers } from './headers'; // keep your existing headers object

/**
 * Extracts direct GDrive links from a gdflix download page.
 * Works in both Node.js (v18+) and modern browsers.
 * @param {string} link - The gdflix page URL
 * @param {AbortSignal} signal - Optional abort signal
 * @returns {Promise<Array<{server: string, link: string, type: string}>>}
 */
export async function gdFlixExtracter(link, signal) {
  try {
    const streamLinks = [];

    // ---- Helper: fetch with headers & signal ----
    async function fetchWithHeaders(url, options = {}) {
      const response = await fetch(url, {
        ...options,
        headers: { ...headers, ...options.headers },
        signal: signal || options.signal,
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return response;
    }

    // ---- Initial request ----
    const initialRes = await fetchWithHeaders(link);
    let html = await initialRes.text();
    let $drive = cheerio.load(html);

    // ---- Handle onload redirect ----
    const onloadAttr = $drive('body').attr('onload');
    if (onloadAttr?.includes('location.replace')) {
      const newLink = onloadAttr.split("location.replace('")?.[1]?.split("'")?.[0];
      if (newLink) {
        const redirectRes = await fetchWithHeaders(newLink);
        html = await redirectRes.text();
        $drive = cheerio.load(html);
      }
    }

    // ---- Extract the primary seed link ----
    const seed = $drive('.btn-success.btn-lg.h6, .btn-danger.btn-lg.h6').attr('href') || link;

    if (seed?.includes('workers.dev')) {
      // Workers.dev -> GDrive direct link
      const seedRes = await fetchWithHeaders(seed);
      // After redirects, fetch gives the final URL in .url
      const finalUrl = seedRes.url;
      const newLink = finalUrl.includes('?url=')
        ? finalUrl.split('?url=')[1]
        : finalUrl;
      streamLinks.push({ server: 'G-Drive', link: newLink, type: 'mkv' });
    } 
    else if (seed?.includes('?keys=')) {
      // Instant GDrive via API
      const instantToken = seed.split('=')[1];
      const formData = new FormData();
      formData.append('keys', instantToken);
      const videoSeedUrl = seed.split('/').slice(0, 3).join('/') + '/api';

      const apiRes = await fetch(videoSeedUrl, {
        method: 'POST',
        body: formData,
        headers: { 'x-token': videoSeedUrl },
        signal,
      });
      const instantLinkData = await apiRes.json();

      if (instantLinkData.error === false) {
        streamLinks.push({
          server: 'Gdrive-Instant',
          link: instantLinkData.url,
          type: 'mkv',
        });
      }
    }

    return streamLinks;
  } catch (err) {
    console.error('gdFlixExtracter Error:', err);
    return [];
  }
}