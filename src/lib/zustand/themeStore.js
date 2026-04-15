import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

const useThemeStore = create(
  persist(
    (set) => ({
      // Initial state
      primary: '#FF6347', // Default primary color
      isCustom: false,    // Default to not a custom theme

      // Actions/setter functions
      setPrimary: (color) => set({ primary: color }),
      setCustom: (isCustom) => set({ isCustom }),
    }),
    {
      name: 'theme-storage',
      storage: createJSONStorage(() => localStorage),
    }
  )
);

export default useThemeStore;