import { contextBridge, ipcRenderer } from 'electron';
import App from '../app';

const windowLoaded = new Promise((resolve) => {
  window.onload = resolve;
});

ipcRenderer.send('request-worker-channel');

ipcRenderer.once('provide-worker-channel', async (event) => {
  await windowLoaded;
  // transfer ports to main window to allow communication with worker
  window.postMessage('main-world-port', '*', event.ports);
});

contextBridge.exposeInMainWorld('electron', {
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  platform: process.platform,
  isElectron: true,
  isElectronDev: App.isDevelopmentMode(),
  onOrgAdded: (callback) => ipcRenderer.on('org-added', callback),
});
