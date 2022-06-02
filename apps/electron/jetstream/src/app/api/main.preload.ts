import { ElectronPreferences } from '@jetstream/types';
import { contextBridge, ipcRenderer } from 'electron';
import { ENV } from './env';

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
  const isElectronDev = await ipcRenderer.invoke('is-dev');
  contextBridge.exposeInMainWorld('electron', {
    initialPreferences: await ipcRenderer.invoke('load-preferences'),
    loadPreferences: () => ipcRenderer.invoke('load-preferences'),
    savePreferences: (preferences: ElectronPreferences) => ipcRenderer.invoke('save-preferences', preferences),
    logout: () => ipcRenderer.send('logout'),
    getAppVersion: () => ipcRenderer.invoke('get-app-version'),
    isElectronDev,
    platform: process.platform,
    isElectron: true,
    isFocused: () => hasFocus,
    onPreferencesChanged: (callback) => {
      ipcRenderer.on('preferences-updated', callback);
    },
    onOrgAdded: (callback) => {
      if (orgAddedCallback) {
        ipcRenderer.removeListener('org-added', orgAddedCallback);
      }
      orgAddedCallback = callback;
      ipcRenderer.on('org-added', orgAddedCallback);
    },
    appCookie: {
      serverUrl: 'http://localhost',
      environment: isElectronDev ? 'development' : 'production',
      defaultApiVersion: `v${ENV.SFDC_FALLBACK_API_VERSION}`,
      google_appId: process.env.GOOGLE_APP_ID,
      google_apiKey: process.env.GOOGLE_API_KEY,
      google_clientId: process.env.GOOGLE_CLIENT_ID,
    },
  });
})();
