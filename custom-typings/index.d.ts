import type { ElectronPreferences, SalesforceOrgUi } from '../libs/types/src';

// https://webpack.js.org/loaders/worker-loader/#integrating-with-typescript
declare module 'worker-loader!*' {
  class WebpackWorker extends Worker {
    constructor();
  }

  export default WebpackWorker;
}

declare global {
  interface Window {
    electron?: {
      initialPreferences: ElectronPreferences;
      loadPreferences: () => Promise<ElectronPreferences>;
      savePreferences: (preferences: ElectronPreferences) => Promise<ElectronPreferences>;
      getAppVersion: () => Promise<string>;
      logout: () => void;
      onPreferencesChanged: (callback: (event: any, preferences: ElectronPreferences) => void) => void;
      platform: string;
      isElectron: boolean;
      isElectronDev: boolean;
      isFocused: () => boolean;
      // getServerSocket: () => Promise<string>;
      // ipcConnect: (is: string, func: (client: any) => void) => void;
      onOrgAdded: (callback: (event: any, org: SalesforceOrgUi, switchActiveOrg: boolean) => void) => void;
    };
    electronPreferences?: {
      initialPreferences: ElectronPreferences;
      loadPreferences: () => Promise<ElectronPreferences>;
      savePreferences: (preferences: ElectronPreferences) => Promise<ElectronPreferences>;
      pickDirectory: () => Promise<string | null>;
      platform: string;
      isElectron: boolean;
    };
  }
}

export {};
