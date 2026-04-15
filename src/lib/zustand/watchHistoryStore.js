// lib/zustand/watchHistoryStore.js
import { create } from 'zustand';
import { watchHistoryStorage } from '../storage';

const convertStorageToZustand = (items = []) => {
  return items.map(item => ({
    ...item,
    lastPlayed: item.timestamp,
    currentTime: item.progress || 0,
  }));
};

const useWatchHistoryStore = create((set) => ({
  history: convertStorageToZustand(watchHistoryStorage.getWatchHistory() || []),

  addItem: (item) => {
    try {
      const storageItem = {
        id: item.link || item.title,
        title: item.title,
        poster: item.poster,
        provider: item.provider,
        link: item.link,
        timestamp: Date.now(),
        duration: item.duration,
        progress: item.currentTime || item.progress || 0,
      };
      watchHistoryStorage.addToWatchHistory(storageItem);
      set({
        history: convertStorageToZustand(watchHistoryStorage.getWatchHistory() || []),
      });
    } catch (error) {
      console.error('❌ Error adding to watch history:', error);
    }
  },

  updatePlaybackInfo: (link, playbackInfo) => {
    try {
      const history = watchHistoryStorage.getWatchHistory() || [];
      const existingItem = history.find(item => item.link === link);
      if (existingItem) {
        const updatedItem = {
          ...existingItem,
          progress: playbackInfo.currentTime,
          duration: playbackInfo.duration || existingItem.duration,
          timestamp: Date.now(),
        };
        watchHistoryStorage.addToWatchHistory(updatedItem);
      }
      set({
        history: convertStorageToZustand(watchHistoryStorage.getWatchHistory() || []),
      });
    } catch (error) {
      console.error('❌ Error updating watch history:', error);
    }
  },

  removeItem: (item) => {
    watchHistoryStorage.removeFromWatchHistory(item.link);
    set({
      history: convertStorageToZustand(watchHistoryStorage.getWatchHistory() || []),
    });
  },

  clearHistory: () => {
    watchHistoryStorage.clearWatchHistory();
    set({ history: [] });
  },

  updateItemWithInfo: (link, infoData) => {
    try {
      const history = watchHistoryStorage.getWatchHistory() || [];
      const existingItem = history.find(item => item.link === link);
      if (existingItem) {
        const updatedItem = {
          ...existingItem,
          cachedInfoData: infoData,
        };
        watchHistoryStorage.addToWatchHistory(updatedItem);
      }
      set({
        history: convertStorageToZustand(watchHistoryStorage.getWatchHistory() || []),
      });
    } catch (error) {
      console.error('❌ Error updating watch history metadata:', error);
    }
  }
}));

export default useWatchHistoryStore;