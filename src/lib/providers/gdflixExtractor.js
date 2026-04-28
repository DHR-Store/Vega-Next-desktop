// gdflixExtractor.js – works in Electron's main process or renderer with nodeIntegration
import * as cheerio from 'cheerio';
import { headers } from './headers'; // keep your existing headers object

/**
 * Fetch wrapper that adds default headers and merges custom ones.
 * In Electron, `fetch` is globally available (Node 18+ / Electron 19+).
 */
async function fetchWithHeaders(url, options = {}, signalOverride) {
  const mergedOptions = {
    ...options,
    headers: { ...headers, ...options.headers },
    signal: signalOverride || options.signal,
  };
  const response = await fetch(url, mergedOptions);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }
  return response;
}

/**
 * Main entry point – same parameters as before.
 * Returns an array of stream objects: { server, link, type }
 */
export async function gdFlixExtracter(link, signal) {
  try {
    const streamLinks = [];

    // 1. Initial page fetch
    let res = await fetchWithHeaders(link, {}, signal);
    let html = await res.text();
    let $drive = cheerio.load(html);

    // Handle possible onload redirect
    const onloadAttr = $drive('body').attr('onload');
    if (onloadAttr?.includes('location.replace')) {
      const newLink = onloadAttr.split("location.replace('")?.[1]?.split("'")?.[0];
      if (newLink) {
        res = await fetchWithHeaders(newLink, {}, signal);
        html = await res.text();
        $drive = cheerio.load(html);
      }
    }

    // ---- Extract R2 link ----
    try {
      const r2Link =
        $drive('.btn.btn-outline-success').attr('href') ||
        $drive('a:contains("CLOUD DOWNLOAD")').attr('href') ||
        '';
      if (r2Link) {
        streamLinks.push({ server: 'R2', link: r2Link, type: 'mkv' });
      }
    } catch (err) {
      console.log('R2 link not found', err);
    }

    // ---- Extract PixelDrain link ----
    try {
      const pixelDrainLink = $drive('.btn.btn-success').attr('href') || '';
      if (pixelDrainLink) {
        streamLinks.push({
          server: 'PixelDrain',
          link: pixelDrainLink,
          type: 'mkv',
        });
      }
    } catch (err) {
      console.log('PixelDrain link not found', err);
    }

    // ---- Extract Resume Cloud / ResumeBot ----
    try {
      const baseUrl = link.split('/').slice(0, 3).join('/');
      const resumeDrive = $drive('.btn-secondary').attr('href') || '';
      if (resumeDrive) {
        const hostname = new URL(resumeDrive, link).hostname;
        if (resumeDrive.includes('indexbot') || hostname.includes('bot')) {
          // ResumeBot path (requires token)
          const botRes = await fetchWithHeaders(resumeDrive, {}, signal);
          const botHtml = await botRes.text();

          const tokenMatch = botHtml.match(
            /formData\.append\('token', '([a-f0-9]+)'\)/
          );
          const pathMatch = botHtml.match(
            /fetch\('\/download\?id=([a-zA-Z0-9\/+]+)'/
          );
          if (tokenMatch && pathMatch) {
            const token = tokenMatch[1];
            const path = pathMatch[1];
            const botBaseUrl = resumeDrive.split('/download')[0];

            const formData = new FormData();
            formData.append('token', token);

            const downloadRes = await fetch(
              `${botBaseUrl}/download?id=${path}`,
              {
                method: 'POST',
                body: formData,
                headers: {
                  Referer: resumeDrive,
                  Cookie: 'PHPSESSID=7e9658ce7c805dab5bbcea9046f7f308', // might need to be dynamic
                },
                signal,
              }
            );
            const data = await downloadRes.json();
            streamLinks.push({
              server: 'ResumeBot',
              link: data.url,
              type: 'mkv',
            });
          }
        } else {
          // ResumeCloud (simple secondary page)
          const fullUrl = new URL(resumeDrive, baseUrl).href;
          const subRes = await fetchWithHeaders(fullUrl, {}, signal);
          const subHtml = await subRes.text();
          const $sub = cheerio.load(subHtml);
          const resumeLink = $sub('.btn-success').attr('href');
          if (resumeLink) {
            streamLinks.push({
              server: 'ResumeCloud',
              link: resumeLink,
              type: 'mkv',
            });
          }
        }
      }
    } catch (err) {
      console.log('Resume link not found', err);
    }

    // ---- Extract Instant / G-Drive (from .btn-danger) ----
    try {
      const seed = $drive('.btn-danger').attr('href') || '';
      if (seed) {
        // Case 1: no ?url= means the link leads directly to a redirectable GDrive URL
        if (!seed.includes('?url=')) {
          const headRes = await fetch(seed, {
            method: 'HEAD',
            redirect: 'manual',
            headers,
            signal,
          });
          // follow redirect manually using the location header
          const location = headRes.headers.get('location');
          const newLink = location
            ? location.split('?url=')[1] || location
            : seed;
          streamLinks.push({
            server: 'G-Drive',
            link: newLink,
            type: 'mkv',
          });
        } else {
          // Case 2: ?url= contains a token to be posted to /api
          const instantToken = seed.split('=')[1];
          const formData = new FormData();
          formData.append('keys', instantToken);
          const videoSeedUrl = new URL('/api', seed).href;

          const apiRes = await fetch(videoSeedUrl, {
            method: 'POST',
            body: formData,
            headers: { 'x-token': videoSeedUrl },
            signal,
          });
          const instantData = await apiRes.json();
          if (instantData.error === false && instantData.url) {
            streamLinks.push({
              server: 'Gdrive-Instant',
              link: instantData.url,
              type: 'mkv',
            });
          }
        }
      }
    } catch (err) {
      console.log('Instant link not found', err);
    }

    return streamLinks;
  } catch (error) {
    console.log('gdflix error: ', error);
    return [];
  }
}