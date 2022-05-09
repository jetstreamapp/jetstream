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
      getAppVersion: () => Promise<string>;
      platform: string;
      isElectron: boolean;
      isElectronDev: boolean;
      // getServerSocket: () => Promise<string>;
      // ipcConnect: (is: string, func: (client: any) => void) => void;
      onOrgAdded: (callback: (org: SalesforceOrgUi) => void) => void;
      uuid: () => string;
    };
  }
}

export {};
