/* eslint-disable no-var */
import { ElectronAPI } from '@jetstream/desktop/types';
import 'vite/client';

// https://webpack.js.org/loaders/worker-loader/#integrating-with-typescript
declare module 'worker-loader!*' {
  class WebpackWorker extends Worker {
    constructor();
  }

  export default WebpackWorker;
}

declare global {
  var __IS_BROWSER_EXTENSION__: boolean | undefined;
  var __IS_DESKTOP__: boolean | undefined;
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
