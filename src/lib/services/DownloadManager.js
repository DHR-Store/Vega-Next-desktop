import { downloadsStorage } from '../storage';

export class DownloadManager {
  constructor() {
    this.downloads = downloadsStorage.getDownloads() || new Map();
  }

  static getInstance() {
    if (!DownloadManager.instance) {
      DownloadManager.instance = new DownloadManager();
    }
    return DownloadManager.instance;
  }

  updateDownloadStatus(id, status) {
    const download = this.downloads.get(id);
    if (download) {
      download.status = status;
      this.downloads.set(id, download);
      downloadsStorage.saveDownloads(this.downloads);
    }
  }

  updateDownload(id, payload) {
    const download = this.downloads.get(id);
    if (download) {
      Object.assign(download, payload);
      this.downloads.set(id, download);
      downloadsStorage.saveDownloads(this.downloads);
    }
  }

  addDownload(id, payload) {
    this.downloads.set(id, payload);
    downloadsStorage.saveDownloads(this.downloads);
  }

  async cancelDownload(id) {
    // Electron: call IPC to cancel
    const { ipcRenderer } = window.require('electron');
    await ipcRenderer.invoke('download:cancel', id);
    this.removeDownload(id);
  }

  removeDownload(id) {
    this.downloads.delete(id);
    downloadsStorage.saveDownloads(this.downloads);
  }

  getDownload(id) {
    return this.downloads.get(id);
  }

  isDownloaded(id) {
    return this.downloads.has(id) && this.downloads.get(id)?.status === 'completed';
  }

  getAllDownloads() {
    return this.downloads;
  }

  generateDownloadId({ folderName, fileName }) {
    return `${folderName}${fileName}`;
  }
}

export const downloadManager = DownloadManager.getInstance();