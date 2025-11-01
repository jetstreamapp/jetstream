import type { ElectronAPI } from '@jetstream/desktop/types';
import { contextBridge, ipcRenderer } from 'electron';

const API: ElectronAPI = {
  // One-Way to Client
  onAuthenticate: (callback) => ipcRenderer.on('authenticate', (_event, payload) => callback(payload)),
  onOrgAdded: (callback) => ipcRenderer.on('orgAdded', (_event, payload) => callback(payload)),
  onAction: (callback) => ipcRenderer.on('action', (_event, payload) => callback(payload)),
  onUpdateStatus: (callback) => ipcRenderer.on('update-status', (_event, payload) => callback(payload)),
  onDownloadProgress: (callback) => ipcRenderer.on('download-progress', (_event, payload) => callback(payload)),
  // One-Way from Client
  login: () => ipcRenderer.invoke('login'),
  logout: () => ipcRenderer.invoke('logout'),
  // Request / Response
  checkAuth: () => ipcRenderer.invoke('checkAuth'),
  addOrg: (payload) => ipcRenderer.invoke('addOrg', payload),
  selectFolder: () => ipcRenderer.invoke('selectFolder'),
  getPreferences: () => ipcRenderer.invoke('getPreferences'),
  setPreferences: (payload) => ipcRenderer.invoke('setPreferences', payload),
  request: (payload) => ipcRenderer.invoke('request', payload),
  downloadZipToFile: (payload) => ipcRenderer.invoke('downloadZipToFile', payload),
  openFile: (filePath) => ipcRenderer.invoke('openFile', filePath),
  showFileInFolder: (filePath) => ipcRenderer.invoke('showFileInFolder', filePath),
  checkForUpdates: (userInitiated) => ipcRenderer.invoke('checkForUpdates', userInitiated),
  getUpdateStatus: () => ipcRenderer.invoke('getUpdateStatus'),
  installUpdate: () => ipcRenderer.invoke('installUpdate'),
};

contextBridge.exposeInMainWorld('electronAPI', API);
