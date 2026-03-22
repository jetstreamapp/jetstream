/* eslint-disable no-var */
import { ElectronAPI } from '@jetstream/desktop/types';
import 'vite/client';

declare global {
  var __IS_BROWSER_EXTENSION__: boolean | undefined;
  var __IS_DESKTOP__: boolean | undefined;
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
