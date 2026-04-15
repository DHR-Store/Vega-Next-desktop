import axios from 'axios';

async function fetchM3U8(url) {
  try {
    const response = await axios(url, {
      timeout: 10000,
    });
    return response.data;
  } catch (error) {
    console.log('Failed to fetch the M3U8 file:', error);
  }
}

function parseM3U8(data) {
  const lines = data.split('\n');
  const qualityLinks = [];

  lines.forEach((line, index) => {
    if (line.startsWith('#EXT-X-STREAM-INF')) {
      const quality = line.match(/RESOLUTION=\d+x(\d+)/);
      const nextLine = lines[index + 1];
      if (quality && nextLine && !nextLine.startsWith('#')) {
        qualityLinks.push({
          quality: quality[1] + 'p',
          url: nextLine,
        });
      }
    }
  });

  return qualityLinks;
}

export async function getQualityLinks(url) {
  const m3u8Content = await fetchM3U8(url);
  if (m3u8Content) {
    const qualityLinks = parseM3U8(m3u8Content);
    const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);

    qualityLinks.forEach(link => {
      if (!link.url.startsWith('http')) {
        link.url = baseUrl + link.url;
      }
    });

    return qualityLinks;
  }
  return [];
}