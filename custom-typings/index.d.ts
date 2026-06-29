/* eslint-disable no-var */
/// <reference types="vite/client" />

declare var __IS_BROWSER_EXTENSION__: boolean | undefined;
declare var __IS_DESKTOP__: boolean | undefined;
declare var __IS_CANVAS_APP__: boolean | undefined;

interface Window {
  electronAPI?: import('@jetstream/desktop/types').ElectronAPI;
}

declare module 'consolidated-events';
declare module 'document.contains';
