import { extensionStorage } from '../storage/extensionStorage';
import { extensionManager } from './ExtensionManager';
import { settingsStorage } from '../storage';
import { notificationService } from './Notification';

class UpdateProvidersService {
  constructor() {
    this.isUpdating = false;
    this.updateCheckInterval = null;
  }

  // Simple string version comparison helper
  isNewerVersion(available, installed) {
    if (!available || !installed) return false;
    return available.localeCompare(installed, undefined, { numeric: true, sensitivity: 'base' }) > 0;
  }

  async checkForUpdates() {
    try {
      const installedProviders = extensionStorage.getInstalledProviders();
      const availableProviders = await extensionManager.fetchManifest(true);

      const updateInfos = [];

      for (const installed of installedProviders) {
        const available = availableProviders.find(p => p.value === installed.value);

        if (available && this.isNewerVersion(available.version, installed.version)) {
          updateInfos.push({
            provider: available,
            currentVersion: installed.version,
            newVersion: available.version,
            hasUpdate: true,
          });
        } else {
          updateInfos.push({
            provider: installed,
            currentVersion: installed.version,
            newVersion: installed.version,
            hasUpdate: false,
          });
        }
      }

      return updateInfos;
    } catch (error) {
      console.error('Failed to check for provider updates:', error);
      return [];
    }
  }

  async updateAllProviders() {
    if (this.isUpdating) return;
    
    try {
      this.isUpdating = true;
      const updates = await this.checkForUpdates();
      const availableUpdates = updates.filter(u => u.hasUpdate);

      if (availableUpdates.length === 0) return;

      await this.showUpdatingNotification(availableUpdates.map(u => u.provider));

      const updated = [];
      const failed = [];

      for (const update of availableUpdates) {
        try {
          await extensionManager.updateProvider(update.provider);
          updated.push(update.provider);
        } catch (error) {
          failed.push(update.provider);
        }
      }

      await this.showUpdateCompleteNotification(updated, failed);
    } catch (error) {
      console.error('Update all providers failed:', error);
    } finally {
      this.isUpdating = false;
    }
  }

  async showUpdatingNotification(providers) {
    await notificationService.showUpdateProgress(
      'Updating Providers',
      `Updating ${providers.length} provider${providers.length > 1 ? 's' : ''}...`
    );
  }

  async showUpdateCompleteNotification(updated, failed) {
    await notificationService.cancelNotification('updateProgress');

    if (updated.length === 0 && failed.length === 0) {
      return;
    }

    let title = '';
    let body = '';

    if (updated.length > 0 && failed.length === 0) {
      title = 'Providers Updated Successfully';
      body = `${updated.length} provider${updated.length > 1 ? 's' : ''} updated: ${updated.map(p => p.display_name).join(', ')}`;
    } else if (updated.length > 0 && failed.length > 0) {
      title = 'Providers Update Complete';
      body = `${updated.length} updated, ${failed.length} failed`;
    } else {
      title = 'Provider Update Failed';
      body = `Failed to update ${failed.length} provider${failed.length > 1 ? 's' : ''}`;
    }

    await notificationService.displayUpdateNotification({ id: 'updateComplete', title, body });
  }
}

export const updateProvidersService = new UpdateProvidersService();