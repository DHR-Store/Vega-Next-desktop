// lib/downloader.js
const { ipcRenderer } = window.require ? window.require('electron') : { invoke: async () => {} };

let activeDownloadCallbacks = new Map(); // jobId -> { onProgress, onComplete }

export const startDownload = async ({
  url,
  fileName,
  title,
  fileType,
  headers = {},
  onProgress,
  onComplete,
}) => {
  const jobId = await ipcRenderer.invoke('download:start', { url, fileName, fileType, title, headers });
  if (onProgress || onComplete) {
    activeDownloadCallbacks.set(jobId, { onProgress, onComplete });
    // Start polling for progress (or use IPC event)
    const interval = setInterval(async () => {
      const progress = await ipcRenderer.invoke('download:getProgress', jobId);
      if (progress) {
        if (onProgress) onProgress(progress);
        if (progress.status === 'completed') {
          if (onComplete) onComplete(progress.outputPath);
          clearInterval(interval);
          activeDownloadCallbacks.delete(jobId);
        } else if (progress.status === 'error') {
          clearInterval(interval);
          activeDownloadCallbacks.delete(jobId);
        }
      }
    }, 1000);
  }
  return jobId;
};

export const pauseDownload = async (jobId) => {
  return ipcRenderer.invoke('download:pause', jobId);
};

export const resumeDownload = async (jobId) => {
  return ipcRenderer.invoke('download:resume', jobId);
};

export const cancelDownload = async (jobId) => {
  await ipcRenderer.invoke('download:cancel', jobId);
  activeDownloadCallbacks.delete(jobId);
};