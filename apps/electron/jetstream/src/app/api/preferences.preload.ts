import { ElectronPreferences } from '@jetstream/types';
import { contextBridge, ipcRenderer } from 'electron';

(async () => {
  contextBridge.exposeInMainWorld('electronPreferences', {
    initialPreferences: await ipcRenderer.invoke('load-preferences'),
    loadPreferences: () => ipcRenderer.invoke('load-preferences'),
    savePreferences: (preferences: ElectronPreferences) => ipcRenderer.invoke('save-preferences', preferences),
    pickDirectory: () => ipcRenderer.invoke('pick-directory'),
    platform: process.platform,
    isElectron: true,
  });
})();
