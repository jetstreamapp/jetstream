import { contextBridge, ipcRenderer } from 'electron';

const windowLoaded = new Promise((resolve) => {
  window.onload = resolve;
});

ipcRenderer.send('request-worker-channel');

ipcRenderer.once('provide-worker-channel', async (event) => {
  await windowLoaded;
  // transfer ports to main window to allow communication with worker
  window.postMessage('main-world-port', '*', event.ports);
});

let hasFocus = true;

ipcRenderer.on('focused', async (event, isFocused) => {
  hasFocus = isFocused;
});

(async () => {
  let orgAddedCallback;
  contextBridge.exposeInMainWorld('electron', {
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    isElectronDev: await ipcRenderer.invoke('is-dev'),
    platform: process.platform,
    isElectron: true,
    isFocused: () => hasFocus,
    onOrgAdded: (callback) => {
      if (orgAddedCallback) {
        ipcRenderer.removeListener('org-added', orgAddedCallback);
      }
      orgAddedCallback = callback;
      ipcRenderer.on('org-added', orgAddedCallback);
    },
  });
})();
