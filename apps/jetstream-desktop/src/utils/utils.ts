import { app } from 'electron';
import { basename } from 'node:path';
import { SERVER_URL } from '../config/environment';
import { initAppMenu } from '../services/menu.service';

export const isDev = () => !app.isPackaged;
export const isMac = () => process.platform === 'darwin';
export const isWindows = () => process.platform === 'win32';
export const isLinux = () => process.platform === 'linux';

const CspPolicy = {
  'default-src': [`'self'`, 'https://*.google.com', 'https://*.googleapis.com', 'https://*.gstatic.com'],
  'base-uri': [`'self'`],
  'block-all-mixed-content': [],
  'connect-src': [
    `'self'`,
    'app://jetstream',
    SERVER_URL.toString(),
    `ws://${SERVER_URL.host}`,
    `wss://${SERVER_URL.host}`,
    'https://*.salesforce.com',
    'https://www.googleapis.com',
  ],
  'font-src': [`'self'`, 'data:'],
  'frame-ancestors': ["'self'", 'https://getjetstream.app', 'https://*.google.com', 'https://*.googleapis.com', 'https://*.gstatic.com'],
  // 'frame-src': [`'self'`, '*.google.com', '*.googleapis.com', '*.gstatic.com'],
  'img-src': [`'self'`, 'data:', 'https://*.googleusercontent.com', 'https://res.cloudinary.com', 'https://*.gravatar.com'],
  'script-src': [`'self'`, `'unsafe-inline'`, 'https://*.google.com'],
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

/**
 * `basename()` strips path separators but still lets bare dot-segments (`.`/`..`) through, and those
 * resolve to a directory when joined onto a download folder (e.g. `join(dir, '..')` === the parent).
 * Reject them (return `null`) so callers can fall back to a save prompt or a safe default name instead
 * of writing to the folder root.
 */
export function toSafeDownloadFileName(fileName: string): string | null {
  const safeName = basename(fileName);
  if (safeName === '' || safeName === '.' || safeName === '..') {
    return null;
  }
  return safeName;
}

export function setRecentDocument(path: string) {
  app.addRecentDocument(path);
  initAppMenu();
}

export function clearRecentDocuments() {
  app.clearRecentDocuments();
  initAppMenu();
}
