import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

const useContentStore = create(
  persist(
    (set) => ({
      provider: {
        value: 'vega-default',
        display_name: 'Vega Default',
        name: 'Vega Default', // 🛠️ FIXED: Default state contains both to be safe
        type: 'global',
        installed: true,
        disabled: false,
        version: '1.0.0',
        icon: '',
        installedAt: Date.now(),
        lastUpdated: Date.now(),
      },
      
      installedProviders: [
        {
          value: 'vega-default',
          display_name: 'Vega Default',
          name: 'Vega Default', 
          type: 'global',
          installed: true,
          disabled: false,
          version: '1.0.0',
          icon: '',
        }
      ],
      
      availableProviders: [],
      activeExtensionProvider: null,

      setProvider: (provider) => set({ provider }),

      // 🛠️ FIXED: Safe Sorting for mixed name properties
      setInstalledProviders: (providers) =>
        set({
          installedProviders: providers.sort((a, b) => {
            const nameA = a.display_name || a.name || '';
            const nameB = b.display_name || b.name || '';
            return nameA.localeCompare(nameB);
          }),
        }),

      setAvailableProviders: (providers) => set({ availableProviders: providers }),

      setActiveExtensionProvider: (provider) => set({ activeExtensionProvider: provider }),

      installProvider: (newProvider) => set((state) => {
        if (state.installedProviders.find(p => p.value === newProvider.value)) return state;
        
        const updatedProviders = [...state.installedProviders, newProvider];
        return { 
          installedProviders: updatedProviders.sort((a, b) => {
            const nameA = a.display_name || a.name || '';
            const nameB = b.display_name || b.name || '';
            return nameA.localeCompare(nameB);
          })
        };
      }),

      uninstallProvider: (providerValue) => set((state) => {
        const updatedProviders = state.installedProviders.filter(p => p.value !== providerValue);
        
        const activeProvider = state.provider.value === providerValue 
          ? updatedProviders[0] || {} 
          : state.provider;

        return { 
          installedProviders: updatedProviders,
          provider: activeProvider
        };
      })
    }),
    {
      name: 'content-storage',
      storage: createJSONStorage(() => localStorage), 
      partialize: (state) => ({
        provider: state.provider,
        installedProviders: state.installedProviders,
      }),
    }
  )
);

export default useContentStore;