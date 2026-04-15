import axios from 'axios';
import { getBaseUrl } from './getBaseUrl';
import { headers } from './headers';
import * as cheerio from 'cheerio';
import { hubcloudExtracter } from './hubcloudExtractor';
import { gofileExtracter } from './gofileExtracter';
import { superVideoExtractor } from './superVideoExtractor';
import { gdFlixExtracter } from './gdflixExtractor';
import * as crypto from 'crypto';

// Detect Node.js environment
const isNode = typeof process !== 'undefined' && process.versions != null && process.versions.node != null;

// In Node.js, use the native axios (no header stripping)
// In browser, the ProviderManager will override it with its own safe axios
const nodeAxios = axios;

const extractors = {
  hubcloudExtracter,
  gofileExtracter,
  superVideoExtractor,
  gdFlixExtracter,
};

export const createProviderContext = () => {
  return {
    axios: nodeAxios,
    getBaseUrl,
    commonHeaders: headers,
    Crypto: crypto,
    cheerio,
    extractors,
  };
};

export const providerContext = createProviderContext();