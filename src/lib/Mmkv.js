// Web shim for react-native-mmkv-storage
export const MMKV = {
  setString: (key, val) => localStorage.setItem(key, val),
  getString: (key) => localStorage.getItem(key),
  delete: (key) => localStorage.removeItem(key),
  clearStore: () => localStorage.clear(),
};

export const MmmkvCache = {
  setString: (key, val) => localStorage.setItem(`cache_${key}`, val),
  getString: (key) => localStorage.getItem(`cache_${key}`),
  delete: (key) => localStorage.removeItem(`cache_${key}`),
};