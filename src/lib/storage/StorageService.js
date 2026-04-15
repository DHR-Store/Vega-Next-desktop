/**
 * Base storage service that wraps Web localStorage operations.
 * Adapted from MMKV for Web/Electron compatibility.
 */
export class StorageService {
  constructor(prefix = '') {
    this.prefix = prefix;
  }

  _getKey(key) {
    return this.prefix + key;
  }

  getString(key) {
    const val = localStorage.getItem(this._getKey(key));
    return val !== null ? val : undefined;
  }

  setString(key, value) {
    localStorage.setItem(this._getKey(key), value);
  }

  getBool(key, defaultValue) {
    const val = localStorage.getItem(this._getKey(key));
    if (val === null) return defaultValue;
    return val === 'true';
  }

  setBool(key, value) {
    localStorage.setItem(this._getKey(key), value ? 'true' : 'false');
  }

  getNumber(key) {
    const val = localStorage.getItem(this._getKey(key));
    if (val === null) return undefined;
    const parsed = parseFloat(val);
    return isNaN(parsed) ? undefined : parsed;
  }

  setNumber(key, value) {
    localStorage.setItem(this._getKey(key), value.toString());
  }

  getObject(key) {
    const json = localStorage.getItem(this._getKey(key));
    if (!json) return undefined;
    try {
      return JSON.parse(json);
    } catch (e) {
      console.error(`Failed to parse stored object for key ${key}:`, e);
      return undefined;
    }
  }

  setObject(key, value) {
    localStorage.setItem(this._getKey(key), JSON.stringify(value));
  }

  getArray(key) {
    return this.getObject(key);
  }

  setArray(key, value) {
    this.setObject(key, value);
  }

  delete(key) {
    localStorage.removeItem(this._getKey(key));
  }

  contains(key) {
    return localStorage.getItem(this._getKey(key)) !== null;
  }

  clearAll() {
    // Only clear items matching this instance's prefix to avoid wiping unrelated app data
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(this.prefix)) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key));
  }
}

// Export pre-configured instances using prefixes to separate them
export const mainStorage = new StorageService('main_');
export const cacheStorage = new StorageService('cache_');