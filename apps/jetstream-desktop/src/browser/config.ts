import { NativeImage } from 'electron';
import path from 'node:path';
import { ENV } from '../config/environment';
import { isMac } from '../utils/utils';

const getSourceDirectory = () => (ENV.ENVIRONMENT === 'production' ? __dirname : path.join(process.cwd(), 'dist/apps/jetstream-desktop'));

export function getWindowConfig(
  icon: NativeImage,
  config?: Electron.BrowserWindowConstructorOptions
): Electron.BrowserWindowConstructorOptions {
  return {
    width: 800,
    height: 600,
    show: false,
    frame: true,
    titleBarStyle: isMac() ? 'hidden' : 'default',
    trafficLightPosition: isMac() ? { x: 23, y: 17 } : undefined,
    ...(isMac() ? { titleBarOverlay: true } : {}),
    backgroundColor: '#fff',
    icon,
    ...config,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      preload: path.resolve(getSourceDirectory(), 'preload.js'),
      sandbox: false,
      ...config?.webPreferences,
    },
  };
}
