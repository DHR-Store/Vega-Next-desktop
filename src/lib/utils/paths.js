// lib/utils/paths.js
// Renderer: use IPC to get the Vega downloads folder from main process

const { ipcRenderer } = window.require ? window.require('electron') : { invoke: async () => '' };

export async function getVegaDownloadsFolder() {
  return await ipcRenderer.invoke('get-vega-folder');
}