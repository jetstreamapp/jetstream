/* eslint-disable no-var */
import 'vite/client';

// https://webpack.js.org/loaders/worker-loader/#integrating-with-typescript
declare module 'worker-loader!*' {
  class WebpackWorker extends Worker {
    constructor();
  }

  export default WebpackWorker;
}

declare global {
  var __IS_CHROME_EXTENSION__: boolean | undefined;
  var __ROUTE_SUFFIX__: string | undefined;

  interface Window {
    // placeholder for any global properties
  }
}
