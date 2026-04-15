class ExtensionManager {
  constructor() {
    // Default official repository
    this.defaultRepos = ['DHR-Store/vega-providers'];
    this.moduleCache = new Map();
    this.storagePrefix = 'script_cache_';
    this.repoStorageKey = 'vega_custom_repos';
  }

  /**
   * Retrieves all repositories (default + user added)
   */
  getRepos() {
    try {
      const customRepos = JSON.parse(localStorage.getItem(this.repoStorageKey) || '[]');
      return [...new Set([...this.defaultRepos, ...customRepos])];
    } catch (e) {
      return this.defaultRepos;
    }
  }

  /**
   * Adds a new repository source (Format: owner/repo)
   */
  addRepo(repoPath) {
    const cleanPath = repoPath.trim();
    if (!cleanPath.includes('/')) return false; // Basic validation
    
    let customRepos = JSON.parse(localStorage.getItem(this.repoStorageKey) || '[]');
    if (!customRepos.includes(cleanPath) && !this.defaultRepos.includes(cleanPath)) {
      customRepos.push(cleanPath);
      localStorage.setItem(this.repoStorageKey, JSON.stringify(customRepos));
      return true;
    }
    return false; // Already exists
  }

  /**
   * Removes a custom repository
   */
  removeRepo(repoPath) {
    if (this.defaultRepos.includes(repoPath)) return false; // Cannot remove default
    let customRepos = JSON.parse(localStorage.getItem(this.repoStorageKey) || '[]');
    customRepos = customRepos.filter(r => r !== repoPath);
    localStorage.setItem(this.repoStorageKey, JSON.stringify(customRepos));
    return true;
  }

  getRepoBaseUrl(repoPath) {
    return `https://raw.githubusercontent.com/${repoPath}/refs/heads/main`;
  }

  /**
   * Fetches manifests from ALL configured repositories and combines them
   */
  async fetchManifest() {
    const repos = this.getRepos();
    let combinedProviders = [];

    console.log(`[ExtensionManager] Fetching manifests from ${repos.length} sources...`);

    const fetchPromises = repos.map(async (repo) => {
      try {
        const baseUrl = this.getRepoBaseUrl(repo);
        const manifestUrl = `${baseUrl}/manifest.json?t=${Date.now()}`;
        
        const response = await fetch(manifestUrl);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        
        const providers = data
          .filter(item => item.disabled !== true)
          .map(item => ({
            value: item.value,
            original_value: item.value,
            name: item.display_name || item.name || 'Unknown Provider',
            version: item.version || '1.0.0',
            type: item.type || 'global',
            icon: item.icon || '',
            category: item.category || this._inferCategory(item.value),
            repo: repo, // Tag with the source repo
            baseUrl: baseUrl // Store base URL for module downloading
          }));
          
        return providers;
      } catch (error) {
        console.error(`[ExtensionManager] Manifest fetch error for ${repo}:`, error);
        return []; // Return empty array on failure so Promise.all doesn't crash
      }
    });

    const results = await Promise.all(fetchPromises);
    results.forEach(repoProviders => {
      combinedProviders = [...combinedProviders, ...repoProviders];
    });

    return combinedProviders;
  }

  _inferCategory(value) {
    const lower = value.toLowerCase();
    if (lower.includes('anime')) return 'anime';
    if (lower.includes('series') || lower.includes('tv')) return 'series';
    return 'movies';
  }

  /**
   * Fetches individual JS files using the specific provider's baseUrl
   */
  async getProviderModule(folderName, moduleType = 'catalog', providerBaseUrl) {
    const storageKey = `${this.storagePrefix}${folderName}_${moduleType}`;
    const baseUrl = providerBaseUrl || this.getRepoBaseUrl(this.defaultRepos[0]);

    if (this.moduleCache.has(storageKey)) return this.moduleCache.get(storageKey);
    
    const localSaved = localStorage.getItem(storageKey);
    if (localSaved) {
      this.moduleCache.set(storageKey, localSaved);
      return localSaved;
    }

    try {
      const url = `${baseUrl}/dist/${folderName}/${moduleType}.js?t=${Date.now()}`;
      const response = await fetch(url);

      if (response.status === 404) return null;
      if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);

      const rawJsCode = await response.text();
      if (rawJsCode.trim().startsWith('<')) throw new Error("Received HTML instead of Javascript");

      this.moduleCache.set(storageKey, rawJsCode);
      localStorage.setItem(storageKey, rawJsCode);
      return rawJsCode;
    } catch (error) {
      console.error(`[ExtensionManager] Error loading ${moduleType} for ${folderName}:`, error.message);
      return null;
    }
  }

  async installExtension(provider) {
    const requiredFiles = ['catalog', 'meta', 'stream', 'posts'];
    const folderName = provider.original_value || provider.value;
    let successCount = 0;

    console.log(`[ExtensionManager] Installing ${provider.name} from ${provider.repo}...`);
    
    const downloadPromises = requiredFiles.map(async (file) => {
      // Pass the specific provider's base URL
      const code = await this.getProviderModule(folderName, file, provider.baseUrl);
      if (code) successCount++;
    });
    
    await Promise.all(downloadPromises);

    if (successCount > 0) {
      console.log(`✅ Successfully installed ${successCount} modules for ${provider.name}`);
      return true;
    }
    console.error(`❌ Installation failed: No modules found for ${folderName}`);
    return false;
  }

  clearCache(folderName) {
    this.moduleCache.clear();
    Object.keys(localStorage)
      .filter(key => key.startsWith(this.storagePrefix))
      .forEach(key => {
        if (!folderName || key.includes(folderName)) {
          localStorage.removeItem(key);
        }
      });
  }
}

export const extensionManager = new ExtensionManager();