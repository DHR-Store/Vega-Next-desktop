import { extensionManager } from './ExtensionManager';
import { createProviderContext } from '../providers/providerContext';
import * as cheerio from 'cheerio';
import axios from 'axios';

// Detect environment reliably (for Vite/Webpack compatibility)
const isNode = typeof process !== 'undefined' && 
               process.versions != null && 
               process.versions.node != null &&
               // Exclude browser-like environments with process but no actual Node
               !(typeof window !== 'undefined' && window.document);

// Get default headers from providerContext (which imports headers.js)
let defaultHeaders = {};
try {
  const tempCtx = createProviderContext();
  defaultHeaders = tempCtx.commonHeaders || {};
} catch (e) {
  console.warn('Could not load commonHeaders, using fallback');
  defaultHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://watchanimeworld.net/',
    'Origin': 'https://watchanimeworld.net',
  };
}

// Create axios instance (will be replaced in Node with a custom one)
let nodeAxios = axios.create();

if (isNode) {
  // Dynamically import Node modules only when in Node environment
  const http = await import('http');
  const https = await import('https');
  nodeAxios = axios.create({
    httpAgent: new http.Agent({ keepAlive: true }),
    httpsAgent: new https.Agent({ keepAlive: true }),
    headers: { ...defaultHeaders },
  });
} else {
  // Browser: strip forbidden headers
  const FORBIDDEN_HEADERS = [
    'user-agent', 'referer', 'origin', 'host', 'cookie', 'dnt',
    'sec-ch-ua', 'sec-ch-ua-mobile', 'sec-ch-ua-platform',
    'sec-fetch-dest', 'sec-fetch-mode', 'sec-fetch-site', 'sec-fetch-user',
    'connection', 'accept-encoding'
  ];
  nodeAxios.interceptors.request.use((config) => {
    if (config.headers) {
      Object.keys(config.headers).forEach((key) => {
        if (FORBIDDEN_HEADERS.includes(key.toLowerCase())) {
          delete config.headers[key];
        }
      });
    }
    return config;
  });
}

class ProviderManager {
  _findExportedFunction(exports, names) {
    if (!exports) return null;
    if (typeof exports === 'function') return exports;
    if (typeof exports.default === 'function') return exports.default;
    for (const name of names) {
      if (typeof exports[name] === 'function') return exports[name];
      if (exports.default && typeof exports.default[name] === 'function') return exports.default[name];
    }
    const findFn = (obj) => {
      if (!obj || typeof obj !== 'object') return null;
      for (const key of Object.keys(obj)) {
        if (typeof obj[key] === 'function') return obj[key];
      }
      return null;
    };
    return findFn(exports) || findFn(exports.default);
  }

  _normalizeFolderName(prov) {
    let name = prov?.original_value || prov?.value || prov;
    if (typeof name === 'string' && name.includes('vega')) return 'vega';
    return name;
  }

  _createSafeProviderContext(signal, originalLink = null) {
    let ctx;
    try {
      ctx = createProviderContext();
    } catch (e) {
      console.warn('createProviderContext failed, using fallback');
      ctx = {};
    }
    if (!ctx || typeof ctx !== 'object') ctx = {};

    ctx.axios = nodeAxios;
    ctx.Axios = nodeAxios;

    if (!ctx.commonHeaders) {
      ctx.commonHeaders = { ...defaultHeaders };
    }

    if (originalLink) {
      ctx.refererUrl = originalLink;
      if (!ctx.commonHeaders['Referer']) {
        ctx.commonHeaders['Referer'] = originalLink;
      }
    }

    if (signal) ctx.signal = signal;
    return ctx;
  }

  executeModule(jsCodeString, providerValue) {
    if (!jsCodeString) return {};
    try {
      const module = { exports: {} };
      const exports = module.exports;

      const requireMock = (pkg) => {
        if (pkg === 'axios') return nodeAxios;
        if (pkg === 'cheerio') return cheerio;
        // Only provide http/https mocks if we are in Node (they won't be called in browser anyway)
        if (isNode && pkg === 'http') return require('http');
        if (isNode && pkg === 'https') return require('https');
        return {};
      };

      const ctx = this._createSafeProviderContext();

      const __awaiter = function (thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
          function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
          function rejected(value) { try { step(generator.throw(value)); } catch (e) { reject(e); } }
          function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
          step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
      };

      const safeWindow = typeof window !== 'undefined' ? window : {};
      const safeGlobal = typeof global !== 'undefined' ? global : {};

      // Node.js fetch implementation (only used if isNode)
      const nodeFetch = async (url, options = {}) => {
        try {
          const requestHeaders = {
            ...defaultHeaders,
            ...(options.headers || {}),
          };
          const response = await nodeAxios({
            url,
            method: options.method || 'GET',
            headers: requestHeaders,
            data: options.body,
            responseType: 'arraybuffer',
          });
          return {
            ok: response.status >= 200 && response.status < 300,
            status: response.status,
            json: async () => JSON.parse(response.data.toString()),
            text: async () => response.data.toString(),
            arrayBuffer: async () => response.data,
          };
        } catch (err) {
          return {
            ok: false,
            status: err.response?.status || 500,
            json: async () => ({ error: err.message }),
            text: async () => err.message,
          };
        }
      };

      const executor = new Function(
        'module', 'exports', 'require', 'console', 'Promise', 'providerContext',
        'atob', 'btoa', 'URL', 'URLSearchParams', 'FormData', 'Uint8Array', 'TextEncoder', 'fetch', '__awaiter',
        'window', 'global', 'document', 'setTimeout', 'clearTimeout',
        `"use strict";\n${jsCodeString}`
      );

      executor(
        module, exports, requireMock, console, Promise, ctx,
        typeof atob !== 'undefined' ? atob : null,
        typeof btoa !== 'undefined' ? btoa : null,
        typeof URL !== 'undefined' ? URL : null,
        typeof URLSearchParams !== 'undefined' ? URLSearchParams : null,
        typeof FormData !== 'undefined' ? FormData : null,
        typeof Uint8Array !== 'undefined' ? Uint8Array : null,
        typeof TextEncoder !== 'undefined' ? TextEncoder : null,
        isNode ? nodeFetch : window.fetch,
        __awaiter,
        safeWindow, safeGlobal, safeWindow.document || {},
        setTimeout, clearTimeout
      );

      return module.exports;
    } catch (error) {
      console.error(`[ProviderManager] Sandbox Execution error in ${providerValue}:`, error);
      return {};
    }
  }

  // All the public methods (getCatalog, getPosts, etc.) remain unchanged from your original.
  // I'll include them here for completeness, but they are identical to your previous version.

  async getCatalog(args) {
    const folderName = this._normalizeFolderName(args.providerValue);
    const catalogCode = await extensionManager.getProviderModule(folderName, 'catalog');
    if (!catalogCode) return [{ title: "Latest", filter: "latest" }];
    const exports = this.executeModule(catalogCode, folderName);
    const catalogArray = exports.catalog || exports.default?.catalog || (Array.isArray(exports) ? exports : []);
    return catalogArray.length > 0 ? catalogArray : [{ title: "Latest", filter: "latest" }];
  }

  async getPosts(args) {
    const { filter, page = 1, providerValue, signal } = args;
    const folderName = this._normalizeFolderName(providerValue);
    let code = await extensionManager.getProviderModule(folderName, 'posts') ||
               await extensionManager.getProviderModule(folderName, 'catalog');
    if (!code) return [];

    const exports = this.executeModule(code, folderName);
    const getPostsFn = this._findExportedFunction(exports, ['getPosts', 'posts']);
    if (!getPostsFn) return [];

    const ctx = this._createSafeProviderContext(signal);
    try {
      let response;
      try {
        response = await getPostsFn({ filter, page, providerContext: ctx });
      } catch (err1) {
        response = await getPostsFn(filter, page, ctx);
      }
      return Array.isArray(response) ? response : (response?.posts || response?.list || []);
    } catch (e) {
      console.error(`[ProviderManager] getPosts error for ${folderName}:`, e);
      return [];
    }
  }

  async getSearchPosts(args) {
    const { searchQuery, page = 1, providerValue, signal } = args;
    const folderName = this._normalizeFolderName(providerValue);
    let code = await extensionManager.getProviderModule(folderName, 'posts') ||
               await extensionManager.getProviderModule(folderName, 'catalog');
    if (!code) return [];

    const exports = this.executeModule(code, folderName);
    let fn = this._findExportedFunction(exports, ['getSearchPosts', 'searchPosts']);
    if (!fn) {
      fn = this._findExportedFunction(exports, ['getPosts', 'posts']);
      if (!fn) return [];
    }

    const ctx = this._createSafeProviderContext(signal);
    try {
      let response;
      try {
        response = await fn({ searchQuery, page, filter: searchQuery, providerContext: ctx });
      } catch (err1) {
        response = await fn(searchQuery, page, ctx);
      }
      return Array.isArray(response) ? response : (response?.posts || response?.list || []);
    } catch (e) {
      console.error(`[ProviderManager] getSearchPosts error for ${folderName}:`, e);
      return [];
    }
  }

  async getMetaData(args) {
    const { link, providerValue, signal } = args;
    const folderName = this._normalizeFolderName(providerValue);
    let code = await extensionManager.getProviderModule(folderName, 'meta') ||
               await extensionManager.getProviderModule(folderName, 'catalog');
    const exports = this.executeModule(code, folderName);
    const fn = this._findExportedFunction(exports, ['getMetaData', 'getMeta', 'meta', 'info']);
    if (!fn) throw new Error(`Metadata function not found for ${folderName}`);

    const ctx = this._createSafeProviderContext(signal);
    try {
      return await fn({ url: link, link, providerContext: ctx });
    } catch (err1) {
      return await fn(link, ctx);
    }
  }

  async getEpisodes(args) {
    const { link, providerValue, signal } = args;
    const folderName = this._normalizeFolderName(providerValue);
    
    let code = await extensionManager.getProviderModule(folderName, 'episodes') ||
               await extensionManager.getProviderModule(folderName, 'meta') ||
               await extensionManager.getProviderModule(folderName, 'catalog');
    if (!code) {
      console.warn(`[ProviderManager] No episode module for ${folderName}`);
      return [];
    }
    
    const exports = this.executeModule(code, folderName);
    const fn = this._findExportedFunction(exports, ['getEpisodes', 'GetEpisodeLinks', 'episodes']);
    if (!fn) {
      console.warn(`[ProviderManager] No episode function in ${folderName}`);
      return [];
    }

    const ctx = this._createSafeProviderContext(signal, link);
    
    const extractEpisodes = (raw, depth = 0) => {
      if (depth > 3) return [];
      if (!raw) return [];
      if (Array.isArray(raw)) {
        if (raw.length > 0 && (raw[0].title || raw[0].name || raw[0].link || raw[0].url)) {
          return raw;
        }
        for (const item of raw) {
          const found = extractEpisodes(item, depth + 1);
          if (found.length > 0) return found;
        }
        return [];
      }
      if (typeof raw === 'object') {
        const priorityKeys = ['episodes', 'links', 'list', 'data', 'results', 'seasons', 'season', 'items', 'episodeList'];
        for (const key of priorityKeys) {
          if (raw[key] && Array.isArray(raw[key])) {
            const arr = raw[key];
            if (arr.length > 0 && (arr[0].title || arr[0].name || arr[0].link || arr[0].url)) {
              return arr;
            }
          }
        }
        for (const key of Object.keys(raw)) {
          const val = raw[key];
          if (val && typeof val === 'object') {
            const found = extractEpisodes(val, depth + 1);
            if (found.length > 0) return found;
          }
        }
        if ((raw.link || raw.url || raw.href) && (raw.title || raw.name)) {
          return [raw];
        }
      }
      return [];
    };

    try {
      let raw;
      try {
        raw = await fn({ url: link, providerContext: ctx });
      } catch (err1) {
        raw = await fn(link, ctx);
      }
      
      const episodes = extractEpisodes(raw);
      const validEpisodes = episodes.filter(ep => 
        ep && (ep.title || ep.name || ep.label || ep.link || ep.url || ep.href)
      );
      return validEpisodes;
    } catch (error) {
      console.error(`[ProviderManager] getEpisodes error for ${folderName}:`, error);
      return [];
    }
  }

  async getStream(args) {
    const { link, type = 'movie', providerValue, signal } = args;
    const folderName = this._normalizeFolderName(providerValue);
    let code = await extensionManager.getProviderModule(folderName, 'stream') ||
               await extensionManager.getProviderModule(folderName, 'episodes') ||
               await extensionManager.getProviderModule(folderName, 'meta');
    const exports = this.executeModule(code, folderName);
    const fn = this._findExportedFunction(exports, ['getStream', 'stream', 'GetStream']);
    if (!fn) throw new Error(`Stream function not found for ${folderName}`);

    const ctx = this._createSafeProviderContext(signal, link);
    try {
      let result;
      try {
        result = await fn({ url: link, link, type, providerContext: ctx });
      } catch (err1) {
        result = await fn(link, type, ctx);
      }
      const streams = Array.isArray(result) ? result : (result ? [result] : []);
      if (streams.length === 0) {
        throw new Error('No playable streams returned from provider');
      }
      return streams;
    } catch (error) {
      if (error.response?.status === 404 || error.message?.includes('404')) {
        throw new Error(`Stream extraction failed (404). The video server requires valid Referer/User-Agent headers. Ensure your provider scripts use the headers from 'headers.js' correctly.`);
      }
      throw error;
    }
  }
}

export const providerManager = new ProviderManager();