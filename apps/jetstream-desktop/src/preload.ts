import { ElectronAPI } from '@jetstream/desktop/types';
import { contextBridge, ipcRenderer } from 'electron';

const API: ElectronAPI = {
  // One-Way to Client
  onAuthenticate: (callback) => ipcRenderer.on('authenticate', (_event, payload) => callback(payload)),
  onOrgAdded: (callback) => ipcRenderer.on('orgAdded', (_event, payload) => callback(payload)),
  // One-Way from Client
  login: () => ipcRenderer.invoke('login'),
  logout: () => ipcRenderer.invoke('logout'),
  // Request / Response
  checkAuth: () => ipcRenderer.invoke('checkAuth'),
  addOrg: (payload) => ipcRenderer.invoke('addOrg', payload),
  getAppCookie: () => ipcRenderer.invoke('getAppCookie'),
  selectFolder: () => ipcRenderer.invoke('selectFolder'),
  getPreferences: () => ipcRenderer.invoke('getPreferences'),
  setPreferences: (payload) => ipcRenderer.invoke('setPreferences', payload),
  request: (payload) => ipcRenderer.invoke('request', payload),
};

contextBridge.exposeInMainWorld('electronAPI', API);
