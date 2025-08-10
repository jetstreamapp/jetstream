import type { ElectronAPI } from '@jetstream/desktop/types';
import { contextBridge, ipcRenderer } from 'electron';

const API: ElectronAPI = {
  // One-Way to Client
  onAuthenticate: (callback) => ipcRenderer.on('authenticate', (_event, payload) => callback(payload)),
  onOrgAdded: (callback) => ipcRenderer.on('orgAdded', (_event, payload) => callback(payload)),
  onAction: (callback) => ipcRenderer.on('action', (_event, payload) => callback(payload)),
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
  // Window control API for menu actions
  openNewWindow: () => ipcRenderer.invoke('openNewWindow'),
  quit: () => ipcRenderer.invoke('quit'),
  toggleDevTools: () => ipcRenderer.invoke('toggleDevTools'),
  resetZoom: () => ipcRenderer.invoke('resetZoom'),
  zoomIn: () => ipcRenderer.invoke('zoomIn'),
  zoomOut: () => ipcRenderer.invoke('zoomOut'),
  toggleFullscreen: () => ipcRenderer.invoke('toggleFullscreen'),
  minimize: () => ipcRenderer.invoke('minimize'),
  close: () => ipcRenderer.invoke('close'),
};

contextBridge.exposeInMainWorld('electronAPI', API);
