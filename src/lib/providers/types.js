/**
 * This file contains JSDoc type definitions to maintain IntelliSense 
 * and auto-complete in a pure JavaScript environment.
 */

// ==========================================
// RUNTIME EXPORTS
// ==========================================

/**
 * JavaScript equivalent of the TypeScript TextTrackType Enum
 */
export const TextTrackType = {
  SUBRIP: 'application/x-subrip',
  TTML: 'application/ttml+xml',
  VTT: 'text/vtt',
};

// ==========================================
// DUMMY EXPORTS (To prevent Vite crashes)
// ==========================================
// These empty variables allow your other JS files to keep their old 
// `import { Post, Stream, Info } from './types'` statements without throwing a SyntaxError.

export const ProvidersList = null;
export const Post = null;
export const TextTrack = null;
export const Stream = null;
export const EpisodeLink = null;
export const DirectLink = null;
export const Link = null;
export const Info = null;
export const Catalog = null;
export const ProviderContext = null;
export const ProviderType = null;


// ==========================================
// JSDOC TYPE DEFINITIONS (For Editor IntelliSense)
// ==========================================

/**
 * @typedef {Object} ProvidersList
 * @property {string} name
 * @property {string} value
 * @property {string} category
 * @property {string} type
 * @property {string} flag
 */

/**
 * @typedef {Object} Post
 * @property {string} title
 * @property {string} link
 * @property {string} image
 * @property {string} [provider]
 */

/**
 * @typedef {Object} TextTrack
 * @property {string} title
 * @property {string} language - ISO639_1 language code
 * @property {string} type - Uses TextTrackType values
 * @property {string} uri
 */

/**
 * @typedef {Object} Stream
 * @property {string} server
 * @property {string} link
 * @property {string} type
 * @property {'360' | '480' | '720' | '1080' | '2160'} [quality]
 * @property {TextTrack[]} [subtitles]
 * @property {Record<string, string>} [headers]
 */

/**
 * @typedef {Object} EpisodeLink
 * @property {string} title
 * @property {string} link
 */

/**
 * @typedef {Object} DirectLink
 * @property {string} title
 * @property {string} link
 * @property {'movie' | 'series'} [type]
 */

/**
 * @typedef {Object} Link
 * @property {string} title
 * @property {string} [quality]
 * @property {string} [episodesLink]
 * @property {DirectLink[]} [directLinks]
 */

/**
 * @typedef {Object} Info
 * @property {string} title
 * @property {string} image
 * @property {string} synopsis
 * @property {string} imdbId
 * @property {string} type
 * @property {string[]} [tags]
 * @property {string[]} [cast]
 * @property {string} [rating]
 * @property {Link[]} linkList
 */

/**
 * @typedef {Object} Catalog
 * @property {string} title
 * @property {string} filter
 */

/**
 * @typedef {Object} ProviderContext
 * @property {import('axios').AxiosStatic} axios
 * @property {any} Crypto - Web Crypto API or Expo Crypto fallback
 * @property {function(string): Promise<string>} getBaseUrl
 * @property {Record<string, string>} commonHeaders
 * @property {import('cheerio').CheerioAPI} cheerio
 * @property {Object} extractors
 * @property {function(string, AbortSignal): Promise<Stream[]>} extractors.hubcloudExtracter
 * @property {function(string): Promise<{link: string, token: string}>} extractors.gofileExtracter
 * @property {function(any): Promise<string>} extractors.superVideoExtractor
 * @property {function(string, AbortSignal): Promise<Stream[]>} extractors.gdFlixExtracter
 */

/**
 * @typedef {Object} ProviderType
 * @property {string} [searchFilter]
 * @property {Catalog[]} catalog
 * @property {Catalog[]} genres
 * @property {boolean} [blurImage]
 * @property {string[]} [nonStreamableServer]
 * @property {string[]} [nonDownloadableServer]
 * @property {function({link: string, type: string, signal: AbortSignal, providerContext: ProviderContext}): Promise<Stream[]>} GetStream
 * @property {function({filter: string, page: number, providerValue: string, signal: AbortSignal, providerContext: ProviderContext}): Promise<Post[]>} GetHomePosts
 * @property {function({url: string, providerContext: ProviderContext}): Promise<EpisodeLink[]>} [GetEpisodeLinks]
 * @property {function({link: string, provider: string, providerContext: ProviderContext}): Promise<Info>} GetMetaData
 * @property {function({searchQuery: string, page: number, providerValue: string, signal: AbortSignal, providerContext: ProviderContext}): Promise<Post[]>} GetSearchPosts
 */