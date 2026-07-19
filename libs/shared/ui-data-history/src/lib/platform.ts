/**
 * Local platform detection, mirroring the pattern in `libs/shared/ui-db/src/lib/ui-db.ts` —
 * intentionally NOT imported from `@jetstream/shared/ui-utils` to keep this lib's import graph
 * small enough for the browser extension.
 */

export const isDesktopApp = (): boolean => {
  try {
    return !!globalThis.__IS_DESKTOP__ || (typeof window !== 'undefined' && !!window.electronAPI);
  } catch {
    return false;
  }
};

export const isBrowserExtensionApp = (): boolean => {
  try {
    return !!globalThis.__IS_BROWSER_EXTENSION__ || !!window?.chrome?.runtime?.id;
  } catch {
    return false;
  }
};

export const isCanvasApp = (): boolean => {
  try {
    return !!globalThis.__IS_CANVAS_APP__;
  } catch {
    return false;
  }
};
