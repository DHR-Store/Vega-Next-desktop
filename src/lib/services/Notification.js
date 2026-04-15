class NotificationService {
  constructor() {
    this.initialized = false;
    this.initialize();
  }

  async initialize() {
    if (this.initialized) return;

    // Check if the browser supports notifications
    if ('Notification' in window) {
      if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        await Notification.requestPermission();
      }
    }
    this.initialized = true;
  }

  /**
   * Universal Web Notification trigger
   */
  async displayNotification(options) {
    const { title, body } = options;

    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, { body });
    } else {
      // Fallback for browsers that block notifications
      console.log(`[Notification] ${title}: ${body}`);
    }
  }

  async displayUpdateNotification(options) {
    await this.displayNotification(options);
  }

  async cancelNotification(id) {
    // Web notifications close automatically or are handled by the OS.
    // There is no direct ID-based cancellation without storing Notification instances.
  }

  async showUpdateAvailable(title, body) {
    await this.displayUpdateNotification({ title, body });
  }

  async showUpdateProgress(title, body) {
    await this.displayUpdateNotification({ title, body });
  }
}

export const notificationService = new NotificationService();