// lib/zustand/downloadedStore.js
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { ifExists } from '../file/ifExists';

const useDownloadedStore = create(
  persist(
    (set, get) => ({
      downloaded: {}, // key: fileName (string), value: true
      checkAndSet: async (fileName) => {
        const exists = await ifExists(fileName);
        if (exists) {
          set(state => ({ downloaded: { ...state.downloaded, [fileName]: true } }));
        }
        return exists;
      },
      markAsDownloaded: (fileName) => {
        set(state => ({ downloaded: { ...state.downloaded, [fileName]: true } }));
      },
      markAsDeleted: (fileName) => {
        set(state => {
          const newState = { ...state.downloaded };
          delete newState[fileName];
          return { downloaded: newState };
        });
      },
      isDownloaded: (fileName) => !!get().downloaded[fileName],
    }),
    {
      name: 'downloaded-episodes',
      getStorage: () => localStorage,
    }
  )
);

export default useDownloadedStore;