/**
 * Decodes a packed/obfuscated JavaScript snippet and extracts an M3U8 URL.
 * @param {string} data - HTML or JavaScript containing the eval(...) packer
 * @returns {string} - Extracted M3U8 URL or empty string
 */
export async function superVideoExtractor(data) {
  try {
    const functionRegex = /eval\(function\((.*?)\)\{.*?return p\}.*?\('(.*?)'\.split/;
    const match = functionRegex.exec(data);
    let p = '';
    if (match) {
      const encodedString = match[2];
      p = encodedString.split("',36,")?.[0].trim();
      const a = 36;
      const c = encodedString.split("',36,")[1].slice(2).split('|').length;
      const k = encodedString.split("',36,")[1].slice(2).split('|');

      for (let i = c; i--; ) {
        if (k[i]) {
          const regex = new RegExp('\\b' + i.toString(a) + '\\b', 'g');
          p = p.replace(regex, k[i]);
        }
      }
    }

    const streamUrl = p?.match(/file:\s*"([^"]+\.m3u8.*?)"/)?.[1];
    return streamUrl || '';
  } catch (error) {
    console.error('superVideoExtractor Error:', error);
    return '';
  }
}