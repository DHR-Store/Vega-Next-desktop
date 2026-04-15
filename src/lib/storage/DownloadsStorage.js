import { cacheStorage, mainStorage } from './StorageService';

export const DownloadsKeys = {
  FILES: 'downloadFiles',
  THUMBNAILS: 'downloadThumbnails',
  DOWNLOADED_FILES: 'downloadedFiles',
};

export class DownloadsStorage {
  getDownloads() {
    const downloadsString = mainStorage.getString(DownloadsKeys.DOWNLOADED_FILES);
    if (!downloadsString) {
      return new Map();
    }
    try {
      const downloads = JSON.parse(downloadsString);
      return new Map(Object.entries(downloads));
    } catch (error) {
      console.error('Failed to parse downloads:', error);
      return new Map();
    }
  }

  saveDownloads(downloads) {
    mainStorage.setString(
      DownloadsKeys.DOWNLOADED_FILES,
      JSON.stringify(Object.fromEntries(downloads))
    );
  }

  saveFilesInfo(files) {
    cacheStorage.setObject(DownloadsKeys.FILES, files);
  }

  getFilesInfo() {
    return cacheStorage.getObject(DownloadsKeys.FILES) || null;
  }

  saveThumbnails(thumbnails) {
    cacheStorage.setObject(DownloadsKeys.THUMBNAILS, thumbnails);
  }

  getThumbnails() {
    return cacheStorage.getObject(DownloadsKeys.THUMBNAILS) || null;
  }

  clearDownloadsCache() {
    cacheStorage.delete(DownloadsKeys.FILES);
    cacheStorage.delete(DownloadsKeys.THUMBNAILS);
  }
}

export const downloadsStorage = new DownloadsStorage();