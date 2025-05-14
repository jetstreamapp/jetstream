import { NativeImage } from 'electron';
import path from 'node:path';
import { ENV } from '../config/environment';

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
    // TODO: validate how this looks on windows and linux
    // titleBarStyle: 'default',
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 23, y: 17 },
    ...(process.platform !== 'darwin' ? { titleBarOverlay: true } : {}),
    backgroundColor: '#fff',
    icon,
    ...config,
    webPreferences: {
      // TODO: some way to enable/disable this
      // devTools: ENV.ENVIRONMENT === 'development',
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
