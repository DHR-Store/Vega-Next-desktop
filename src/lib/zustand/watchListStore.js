// lib/zustand/watchListStore.js
import { create } from 'zustand';
import { watchListStorage } from '../storage';

const useWatchListStore = create((set) => ({
  // Initialize from persistent storage
  watchList: watchListStorage.getWatchList() || [],

  // Remove item
  removeItem: (link) => {
    const updated = watchListStorage.removeFromWatchList(link) || [];
    set({ watchList: [...updated] }); // new array reference
  },

  // Add item – uses storage's append logic, then re-fetches
  addToWatchList: (item) => {
    // Add to storage (handles duplicate filtering internally)
    watchListStorage.addToWatchList(item);
    // Re-sync Zustand state with the persisted list
    set({ watchList: watchListStorage.getWatchList() || [] });
  },

  // Alias for backward compatibility
  addItem: (item) => {
    watchListStorage.addToWatchList(item);
    set({ watchList: watchListStorage.getWatchList() || [] });
  },

  // Clear entire watchlist
  clearWatchList: () => {
    watchListStorage.clearWatchList();
    set({ watchList: [] });
  }
}));

export default useWatchListStore;