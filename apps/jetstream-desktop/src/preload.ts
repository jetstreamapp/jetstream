import { IpcEventChannel, type ElectronAPI } from '@jetstream/desktop/types';
import { contextBridge, ipcRenderer } from 'electron';

const API: ElectronAPI = {
  // One-Way to Client
  onAuthenticate: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on(IpcEventChannel.authenticate, handler);
    return () => ipcRenderer.removeListener(IpcEventChannel.authenticate, handler);
  },
  onOrgAdded: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on(IpcEventChannel.orgAdded, handler);
    return () => ipcRenderer.removeListener(IpcEventChannel.orgAdded, handler);
  },
  onAction: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on(IpcEventChannel.action, handler);
    return () => ipcRenderer.removeListener(IpcEventChannel.action, handler);
  },
  onUpdateStatus: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on(IpcEventChannel.updateStatus, handler);
    return () => ipcRenderer.removeListener(IpcEventChannel.updateStatus, handler);
  },
  onDownloadProgress: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on(IpcEventChannel.downloadProgress, handler);
    return () => ipcRenderer.removeListener(IpcEventChannel.downloadProgress, handler);
  },
  onToastMessage: (callback) => {
    const handler = (_event, payload) => callback(payload);
    ipcRenderer.on(IpcEventChannel.toastMessage, handler);
    return () => ipcRenderer.removeListener(IpcEventChannel.toastMessage, handler);
  },
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
