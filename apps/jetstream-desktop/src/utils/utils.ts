import { app } from 'electron';
import { SERVER_URL } from '../config/environment';
import { initAppMenu } from '../services/menu.service';

export const isDev = () => !app.isPackaged;
export const isMac = () => process.platform === 'darwin';
export const isWindows = () => process.platform === 'win32';
export const isLinux = () => process.platform === 'linux';

const CspPolicy = {
  'default-src': [`'self'`, '*.google.com', '*.googleapis.com', '*.gstatic.com'],
  'base-uri': [`'self'`],
  'block-all-mixed-content': [],
  'connect-src': [
    `'self'`,
    'app://jetstream',
    SERVER_URL.toString(),
    `ws://${SERVER_URL.host}`,
    `wss://${SERVER_URL.host}`,
    'https://*.salesforce.com',
  ],
  'font-src': [`'self'`, 'data:'],
  'frame-ancestors': ["'self'", 'getjetstream.app', '*.google.com', '*.googleapis.com', '*.gstatic.com'],
  // 'frame-src': [`'self'`, '*.google.com', '*.googleapis.com', '*.gstatic.com'],
  'img-src': [`'self'`, 'data:', '*.googleusercontent.com'],
  'script-src': [`'self'`, `'unsafe-inline'`, '*.google.com'],
  'script-src-attr': ['none'],
  'style-src': [`'self'`, `'unsafe-inline'`],
  'worker-src': [`'self'`, 'blob:'],
};

export function getCspPolicy() {
  const cspPolicy = Object.entries(CspPolicy)
    .map(([key, value]) => `${key} ${value.join(' ')}`)
    .join('; ');
  return cspPolicy;
}

export function setRecentDocument(path: string) {
  app.addRecentDocument(path);
  initAppMenu();
}

export function clearRecentDocuments() {
  app.clearRecentDocuments();
  initAppMenu();
}
