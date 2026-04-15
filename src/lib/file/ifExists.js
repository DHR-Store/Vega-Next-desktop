// lib/file/ifExists.js
const { ipcRenderer } = window.require ? window.require('electron') : { invoke: async () => false };

export const ifExists = async (fileName) => {
  try {
    return await ipcRenderer.invoke('check-file-exists', fileName);
  } catch (err) {
    console.error('ifExists error:', err);
    return false;
  }
};

export const getLocalFilePath = async (fileName) => {
  try {
    return await ipcRenderer.invoke('get-file-path', fileName);
  } catch (err) {
    console.error('getLocalFilePath error:', err);
    return null;
  }
};