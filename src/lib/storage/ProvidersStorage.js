import { mainStorage } from './StorageService';
// Ensure this path matches your web structure
import { providersList } from '../constants'; 

export const ProvidersKeys = {
  DISABLED_PROVIDERS: 'disabledProviders',
};

export class ProvidersStorage {
  getDisabledProviders() {
    const saved = mainStorage.getObject(ProvidersKeys.DISABLED_PROVIDERS);
    if (!saved || saved.length === 0) {
      const allProviders = (providersList || []).map(p => p.value);
      this.setDisabledProviders(allProviders);
      return allProviders;
    }
    return saved;
  }

  setDisabledProviders(providers) {
    mainStorage.setObject(ProvidersKeys.DISABLED_PROVIDERS, providers);
  }

  enableAllProviders() {
    mainStorage.setObject(ProvidersKeys.DISABLED_PROVIDERS, []);
  }

  toggleProvider(providerId) {
    const disabledProviders = this.getDisabledProviders();

    const newDisabled = disabledProviders.includes(providerId)
      ? disabledProviders.filter(id => id !== providerId)
      : [...disabledProviders, providerId];

    this.setDisabledProviders(newDisabled);
    return newDisabled;
  }

  isProviderDisabled(providerId) {
    return this.getDisabledProviders().includes(providerId);
  }
}

export const providersStorage = new ProvidersStorage();