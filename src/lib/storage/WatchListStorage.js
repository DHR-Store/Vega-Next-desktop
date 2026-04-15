// lib/storage/WatchListStorage.js
import { mainStorage } from './StorageService';

export const WatchListKeys = {
  WATCH_LIST: 'watchlist',
};

export class WatchListStorage {
  getWatchList() {
    return mainStorage.getArray(WatchListKeys.WATCH_LIST) || [];
  }

  addToWatchList(item) {
    const watchList = this.getWatchList();
    const newWatchList = watchList.filter(i => i.link !== item.link);
    newWatchList.push(item);
    mainStorage.setArray(WatchListKeys.WATCH_LIST, newWatchList);
    return newWatchList;
  }

  removeFromWatchList(link) {
    const watchList = this.getWatchList();
    const newWatchList = watchList.filter(item => item.link !== link);
    mainStorage.setArray(WatchListKeys.WATCH_LIST, newWatchList);
    return newWatchList;
  }

  clearWatchList() {
    const emptyList = [];
    mainStorage.setArray(WatchListKeys.WATCH_LIST, emptyList);
    return emptyList;
  }

  isInWatchList(link) {
    const watchList = this.getWatchList();
    return watchList.some(item => item.link === link);
  }
}

export const watchListStorage = new WatchListStorage();