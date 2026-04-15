// lib/zustand/searchStore.js
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const MAX_HISTORY_ITEMS = 30;

const useSearchStore = create(
  persist(
    (set, get) => ({
      history: [],
      
      addToHistory: (query) => {
        const trimmed = query.trim();
        if (!trimmed) return;
        set((state) => {
          const filtered = state.history.filter(item => item !== trimmed);
          const updated = [trimmed, ...filtered];
          return { history: updated.slice(0, MAX_HISTORY_ITEMS) };
        });
      },
      
      removeHistoryItem: (query) => {
        set((state) => ({
          history: state.history.filter(item => item !== query)
        }));
      },
      
      clearHistory: () => {
        set({ history: [] });
      },
    }),
    {
      name: 'search-history-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export default useSearchStore;