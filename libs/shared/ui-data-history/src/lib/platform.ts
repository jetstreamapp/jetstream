/**
 * Local platform detection, mirroring the pattern in `libs/shared/ui-db/src/lib/ui-db.ts` —
 * intentionally NOT imported from `@jetstream/shared/ui-utils` to keep this lib's import graph
 * small enough for the browser extension.
 */

/**
 * Shell-injected globals, typed locally. The ambient `Window` augmentations for these live in
 * `custom-typings/electron.d.ts`, which pulls `@jetstream/desktop/types` into whatever project
 * includes it — exactly the dependency this lib is avoiding.
 */
type ShellWindow = Window & {
  electronAPI?: unknown;
  chrome?: { runtime?: { id?: string } };
};

export const isDesktopApp = (): boolean => {
  try {
    return !!globalThis.__IS_DESKTOP__ || (typeof window !== 'undefined' && !!(window as ShellWindow).electronAPI);
  } catch {
    return false;
  }
};

export const isBrowserExtensionApp = (): boolean => {
  try {
    return !!globalThis.__IS_BROWSER_EXTENSION__ || !!(window as ShellWindow | undefined)?.chrome?.runtime?.id;
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
