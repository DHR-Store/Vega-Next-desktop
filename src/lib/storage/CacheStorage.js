import { cacheStorage } from './StorageService';

export class CacheStorage {
  setString(key, value) {
    if (typeof value !== 'string') {
      console.warn(`CacheStorage.setString: Value for key '${key}' is not a string. Coercing.`);
    }
    cacheStorage.setString(key, value);
  }

  getString(key) {
    return cacheStorage.getString(key);
  }

  setObject(key, value) {
    if (value === undefined) {
      console.warn(`CacheStorage.setObject: Value for key '${key}' is undefined. Deleting key.`);
      cacheStorage.delete(key);
      return;
    }
    cacheStorage.setObject(key, value);
  }

  getObject(key) {
    return cacheStorage.getObject(key);
  }

  delete(key) {
    cacheStorage.delete(key);
  }

  contains(key) {
    return cacheStorage.contains(key);
  }

  clearAll() {
    cacheStorage.clearAll();
  }
}

export const cacheStorageService = new CacheStorage();