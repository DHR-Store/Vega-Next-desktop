import { mainStorage } from './StorageService';

export const SettingsKeys = {
  PRIMARY_COLOR: 'primaryColor',
  IS_CUSTOM_THEME: 'isCustomTheme',
  SHOW_TAB_BAR_LABELS: 'showTabBarLabels',
  CUSTOM_COLOR: 'customColor',
  HAPTIC_FEEDBACK: 'hapticFeedback',
  NOTIFICATIONS_ENABLED: 'notificationsEnabled',
  AUTO_CHECK_UPDATE: 'autoCheckUpdate',
  AUTO_DOWNLOAD: 'autoDownload',
  LOCAL_SERVER_ENABLED: 'localServerEnabled',
  SHOW_BACKGROUND_NOTIFICATION: 'showBackgroundNotification',
  SHOW_MEDIA_CONTROLS: 'showMediaControls',
  SHOW_HAMBURGER_MENU: 'showHamburgerMenu',
  HIDE_SEEK_BUTTONS: 'hideSeekButtons',
  ENABLE_2X_GESTURE: 'enable2xGesture',
  ENABLE_SWIPE_GESTURE: 'enableSwipeGesture',
  EXCLUDED_QUALITIES: 'excludedQualities',
  SUBTITLE_FONT_SIZE: 'subtitleFontSize',
  SUBTITLE_OPACITY: 'subtitleOpacity',
  SUBTITLE_BOTTOM_PADDING: 'subtitleBottomPadding',
  LIST_VIEW_TYPE: 'viewType',
  EXTERNAL_PLAYER: 'useExternalPlayer',
  EXTERNAL_DOWNLOADER: 'useExternalDownloader',
  DISCORD_RPC: 'discordRpc',
  AUTO_PLAY: 'autoPlay',
  AUTO_NEXT: 'autoNext',
};

export class SettingsStorage {
  // UI preferences
  getPrimaryColor() {
    return mainStorage.getString(SettingsKeys.PRIMARY_COLOR) || '#FF6347';
  }
  setPrimaryColor(color) {
    mainStorage.setString(SettingsKeys.PRIMARY_COLOR, color);
  }

  getIsCustomTheme() {
    return mainStorage.getBool(SettingsKeys.IS_CUSTOM_THEME) || false;
  }
  setIsCustomTheme(isCustom) {
    mainStorage.setBool(SettingsKeys.IS_CUSTOM_THEME, isCustom);
  }

  getShowTabBarLabels() {
    return mainStorage.getBool(SettingsKeys.SHOW_TAB_BAR_LABELS) || true;
  }
  setShowTabBarLabels(show) {
    mainStorage.setBool(SettingsKeys.SHOW_TAB_BAR_LABELS, show);
  }

  // Feedback settings
  isHapticFeedbackEnabled() {
    return mainStorage.getBool(SettingsKeys.HAPTIC_FEEDBACK, true) ?? true;
  }
  setHapticFeedbackEnabled(enabled) {
    mainStorage.setBool(SettingsKeys.HAPTIC_FEEDBACK, enabled);
  }

  // Update settings
  isAutoCheckUpdateEnabled() {
    return mainStorage.getBool(SettingsKeys.AUTO_CHECK_UPDATE, true) ?? true;
  }
  setAutoCheckUpdateEnabled(enabled) {
    mainStorage.setBool(SettingsKeys.AUTO_CHECK_UPDATE, enabled);
  }

  // Player settings
  getShowMediaControls() {
    return mainStorage.getBool(SettingsKeys.SHOW_MEDIA_CONTROLS) || true;
  }
  setShowMediaControls(show) {
    mainStorage.setBool(SettingsKeys.SHOW_MEDIA_CONTROLS, show);
  }

  // Quality settings
  getExcludedQualities() {
    return mainStorage.getArray(SettingsKeys.EXCLUDED_QUALITIES) || [];
  }
  setExcludedQualities(qualities) {
    mainStorage.setArray(SettingsKeys.EXCLUDED_QUALITIES, qualities);
  }

  // Subtitle settings
  getSubtitleFontSize() {
    return mainStorage.getNumber(SettingsKeys.SUBTITLE_FONT_SIZE) || 16;
  }
  setSubtitleFontSize(size) {
    mainStorage.setNumber(SettingsKeys.SUBTITLE_FONT_SIZE, size);
  }

  getSubtitleOpacity() {
    const opacityStr = mainStorage.getString(SettingsKeys.SUBTITLE_OPACITY);
    return opacityStr ? parseFloat(opacityStr) : 1;
  }
  setSubtitleOpacity(opacity) {
    mainStorage.setString(SettingsKeys.SUBTITLE_OPACITY, opacity.toString());
  }

  getSubtitleBottomPadding() {
    return mainStorage.getNumber(SettingsKeys.SUBTITLE_BOTTOM_PADDING) || 10;
  }
  setSubtitleBottomPadding(padding) {
    mainStorage.setNumber(SettingsKeys.SUBTITLE_BOTTOM_PADDING, padding);
  }

  getListViewType() {
    return parseInt(mainStorage.getString(SettingsKeys.LIST_VIEW_TYPE) || '1', 10);
  }
  setListViewType(type) {
    mainStorage.setString(SettingsKeys.LIST_VIEW_TYPE, type.toString());
  }

  getBool(key, defaultValue = false) {
    return mainStorage.getBool(key, defaultValue) ?? defaultValue;
  }
  setBool(key, value) {
    mainStorage.setBool(key, value);
  }
}

export const settingsStorage = new SettingsStorage();