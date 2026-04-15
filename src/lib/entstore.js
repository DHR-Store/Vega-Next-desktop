const DOWNLOADS_KEY = 'downloads:files';
const THUMBNAILS_KEY = 'downloads:thumbnails';
const EXTERNAL_FILES_KEY = 'downloads:external_files';
const WATCH_HISTORY_KEY = 'downloads:watch_history';

export const downloadsStorage = {
  saveFilesInfo: async (files) => {
    try {
      localStorage.setItem(DOWNLOADS_KEY, JSON.stringify(files));
    } catch (error) {
      console.error('❌ Failed to save downloads info:', error);
    }
  },

  getFilesInfo: async () => {
    try {
      const jsonValue = localStorage.getItem(DOWNLOADS_KEY);
      return jsonValue ? JSON.parse(jsonValue) : [];
    } catch (error) {
      console.error('❌ Failed to retrieve downloads info:', error);
      return [];
    }
  },

  saveExternalFiles: async (files) => {
    try {
      localStorage.setItem(EXTERNAL_FILES_KEY, JSON.stringify(files));
    } catch (error) {
      console.error('❌ Failed to save external files info:', error);
    }
  },

  getExternalFiles: async () => {
    try {
      const jsonValue = localStorage.getItem(EXTERNAL_FILES_KEY);
      return jsonValue ? JSON.parse(jsonValue) : [];
    } catch (error) {
      console.error('❌ Failed to retrieve external files info:', error);
      return [];
    }
  },

  saveWatchHistory: async (history) => {
    try {
      localStorage.setItem(WATCH_HISTORY_KEY, JSON.stringify(history));
    } catch (error) {
      console.error('❌ Failed to save watch history:', error);
    }
  },

  getWatchHistory: async () => {
    try {
      const jsonValue = localStorage.getItem(WATCH_HISTORY_KEY);
      return jsonValue ? JSON.parse(jsonValue) : [];
    } catch (error) {
      console.error('❌ Failed to retrieve watch history:', error);
      return [];
    }
  },
};