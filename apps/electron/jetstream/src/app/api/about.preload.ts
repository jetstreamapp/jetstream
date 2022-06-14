import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electron', {
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
});
