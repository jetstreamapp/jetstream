import { workspaceRoot } from '@nx/devkit';
import { _electron as electron, ElectronApplication } from '@playwright/test';
import path from 'node:path';

const MAIN_JS_PATH = path.join(workspaceRoot, 'dist/apps/jetstream-desktop/main.js');

/**
 * Resolves the workspace's own installed Electron binary path, for passing as `executablePath` to
 * Playwright's `_electron.launch()`. Playwright's own auto-discovery (when `executablePath` is
 * omitted) does not reliably find a pnpm-managed `electron` install and can fall back to
 * downloading its own copy — passing this explicitly bypasses that ambiguity entirely.
 *
 * Requiring the `electron` package from a plain Node process (not running inside Electron itself,
 * which is exactly what a Playwright test process is) resolves to its executable path as a string,
 * per the `electron` package's own documented behavior — not the Electron API surface.
 */
function resolveElectronExecutablePath(): string {
  const electronPath = require('electron');
  if (typeof electronPath !== 'string') {
    throw new Error("Expected requiring 'electron' outside of an Electron process to return its executable path as a string");
  }
  return electronPath;
}

/**
 * `browser.ts` creates an 800x600 window and immediately calls `maximize()`, which on Linux needs a
 * window manager — CI has none (plain Xvfb), so the app renders at 800px wide there and at whatever
 * the screen size is locally. The navbar is responsive and collapses items into a "More" overflow
 * menu once they no longer fit, so that difference decides whether a nav link exists in the DOM at
 * all. Pin the content size instead, comfortably above the 1280x720 the web E2E suite runs at.
 * The `e2e-ci` target pins the Xvfb screen large enough that this is never clamped.
 */
const WINDOW_CONTENT_SIZE = { width: 1440, height: 900 };

/**
 * Launches the real built desktop main process the same way `pnpm start:desktop` does, isolated to
 * `userDataDir`. `cwd` must be the repo root — `apps/jetstream-desktop/src/browser/config.ts`
 * resolves the preload script relative to `process.cwd()` whenever not running from a packaged
 * build (always true for this launch), so an unpinned cwd means the preload silently fails to
 * attach and `window.electronAPI` is never defined, with no visible error.
 *
 * `--automated-testing` turns off the dev-mode DevTools pane (see `browser.ts`).
 */
export async function launchDesktopElectronApp(userDataDir: string): Promise<ElectronApplication> {
  const electronApp = await electron.launch({
    executablePath: resolveElectronExecutablePath(),
    args: [MAIN_JS_PATH, `--user-data-dir=${userDataDir}`, '--automated-testing'],
    cwd: workspaceRoot,
  });
  // `launch()` can resolve before `main.ts`'s `app.whenReady()` handler has created the window, so
  // wait for it rather than silently sizing nothing.
  await electronApp.firstWindow();
  await electronApp.evaluate(({ BrowserWindow }, { width, height }) => {
    const [browserWindow] = BrowserWindow.getAllWindows();
    if (!browserWindow) {
      throw new Error('Expected the desktop app to have created its window before resizing it');
    }
    // `maximize()` does take effect on macOS/Windows, and a maximized window ignores a resize.
    browserWindow.unmaximize();
    browserWindow.setContentSize(width, height);
  }, WINDOW_CONTENT_SIZE);
  return electronApp;
}
