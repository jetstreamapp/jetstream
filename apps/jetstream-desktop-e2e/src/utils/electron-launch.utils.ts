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
 * Launches the real built desktop main process the same way `pnpm start:desktop` does, isolated to
 * `userDataDir`. `cwd` must be the repo root — `apps/jetstream-desktop/src/browser/config.ts`
 * resolves the preload script relative to `process.cwd()` whenever not running from a packaged
 * build (always true for this launch), so an unpinned cwd means the preload silently fails to
 * attach and `window.electronAPI` is never defined, with no visible error.
 */
export function launchDesktopElectronApp(userDataDir: string): Promise<ElectronApplication> {
  return electron.launch({
    executablePath: resolveElectronExecutablePath(),
    args: [MAIN_JS_PATH, `--user-data-dir=${userDataDir}`],
    cwd: workspaceRoot,
  });
}
