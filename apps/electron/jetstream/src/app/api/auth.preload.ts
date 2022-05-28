import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAuth', {
  login: () => ipcRenderer.send('auth-login'),
  signUp: () => ipcRenderer.send('auth-signup'),
  close: () => ipcRenderer.send('auth-close'),
});
