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
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
