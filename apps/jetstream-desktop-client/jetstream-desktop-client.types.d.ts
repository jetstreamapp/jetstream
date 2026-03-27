import { ElectronAPI } from '@jetstream/desktop/types';
import 'vite/client';

declare global {
  interface Window {
    electronAPI?: ElectronAPI;
  }
}
