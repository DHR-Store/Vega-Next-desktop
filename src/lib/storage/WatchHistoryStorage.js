// lib/storage/WatchHistoryStorage.js
import { mainStorage } from './StorageService';

export const WatchHistoryKeys = {
  WATCH_HISTORY: 'watchHistory',
  SERIES_EPISODES: 'seriesEpisodes',
};

export class WatchHistoryStorage {
  getWatchHistory() {
    return mainStorage.getArray(WatchHistoryKeys.WATCH_HISTORY) || [];
  }

  addToWatchHistory(item) {
    const history = this.getWatchHistory();
    const existingIndex = history.findIndex(i => i.id === item.id);

    if (existingIndex === -1) {
      history.unshift({ ...item, timestamp: Date.now() });
    } else {
      const existingItem = history.splice(existingIndex, 1)[0];
      history.unshift({
        ...existingItem,
        ...item,
        timestamp: Date.now(),
      });
    }

    mainStorage.setArray(WatchHistoryKeys.WATCH_HISTORY, history);
  }

  removeFromWatchHistory(id) {
    const history = this.getWatchHistory();
    const newHistory = history.filter(item => item.id !== id && item.link !== id);
    mainStorage.setArray(WatchHistoryKeys.WATCH_HISTORY, newHistory);
  }

  clearWatchHistory() {
    mainStorage.setArray(WatchHistoryKeys.WATCH_HISTORY, []);
  }

  getSeriesEpisodes(seriesId) {
    const allSeries = mainStorage.getObject(WatchHistoryKeys.SERIES_EPISODES) || {};
    return allSeries[seriesId] || {};
  }

  addSeriesEpisodes(seriesId, episodes) {
    const allSeries = mainStorage.getObject(WatchHistoryKeys.SERIES_EPISODES) || {};
    allSeries[seriesId] = { ...allSeries[seriesId], ...episodes };
    mainStorage.setObject(WatchHistoryKeys.SERIES_EPISODES, allSeries);
  }

  removeSeriesEpisodes(seriesId) {
    const allSeries = mainStorage.getObject(WatchHistoryKeys.SERIES_EPISODES) || {};
    delete allSeries[seriesId];
    mainStorage.setObject(WatchHistoryKeys.SERIES_EPISODES, allSeries);
  }
}

export const watchHistoryStorage = new WatchHistoryStorage();