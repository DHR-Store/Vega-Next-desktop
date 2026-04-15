/**
 * Storage keys for extensions
 */
export const ExtensionKeys = {
  INSTALLED_PROVIDERS: 'installedProviders',
  AVAILABLE_PROVIDERS: 'availableProviders',
  PROVIDER_MODULES: 'providerModules',
  MANIFEST_CACHE: 'manifestCache',
  LAST_MANIFEST_FETCH: 'lastManifestFetch',
};

// 🛠️ FIXED: Added the 'export' keyword to the class
export class ExtensionStorage {
  getInstalledProviders() {
    try {
      const data = localStorage.getItem(ExtensionKeys.INSTALLED_PROVIDERS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  setInstalledProviders(providers) {
    localStorage.setItem(ExtensionKeys.INSTALLED_PROVIDERS, JSON.stringify(providers));
  }

  getAvailableProviders() {
    try {
      const data = localStorage.getItem(ExtensionKeys.AVAILABLE_PROVIDERS);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  setAvailableProviders(providers) {
    localStorage.setItem(ExtensionKeys.AVAILABLE_PROVIDERS, JSON.stringify(providers));
  }

  getProviderModules() {
    try {
      const data = localStorage.getItem(ExtensionKeys.PROVIDER_MODULES);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  saveProviderModule(providerValue, moduleType, code, version) {
    const modules = this.getProviderModules();
    if (!modules[providerValue]) {
      modules[providerValue] = {
        value: providerValue,
        version: version,
        modules: {},
        cachedAt: Date.now(),
      };
    }
    modules[providerValue].modules[moduleType] = code;
    modules[providerValue].cachedAt = Date.now();
    
    localStorage.setItem(ExtensionKeys.PROVIDER_MODULES, JSON.stringify(modules));
  }

  getModule(providerValue, moduleType) {
    const modules = this.getProviderModules();
    return modules[providerValue]?.modules?.[moduleType] || null;
  }

  deleteProviderModules(providerValue) {
    const modules = this.getProviderModules();
    delete modules[providerValue];
    localStorage.setItem(ExtensionKeys.PROVIDER_MODULES, JSON.stringify(modules));
  }

  getManifestCache() {
    try {
      const data = localStorage.getItem(ExtensionKeys.MANIFEST_CACHE);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  setManifestCache(manifest) {
    localStorage.setItem(ExtensionKeys.MANIFEST_CACHE, JSON.stringify(manifest));
    localStorage.setItem(ExtensionKeys.LAST_MANIFEST_FETCH, Date.now().toString());
  }

  getLastManifestFetch() {
    return parseInt(localStorage.getItem(ExtensionKeys.LAST_MANIFEST_FETCH) || '0', 10);
  }

  isManifestCacheExpired() {
    const lastFetch = this.getLastManifestFetch();
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    return now - lastFetch > twentyFourHours;
  }

  clearAll() {
    Object.values(ExtensionKeys).forEach((key) => {
      localStorage.removeItem(key);
    });
  }
}

// We still keep the instance export for files that use the singleton
export const extensionStorage = new ExtensionStorage();