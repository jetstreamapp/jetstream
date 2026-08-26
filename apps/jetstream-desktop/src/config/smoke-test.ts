import { app, BrowserWindow } from 'electron';
import logger from 'electron-log';

const SMOKE_TEST_TIMEOUT_MS = 30_000;

/**
 * Startup smoke test for the packaged build, driven by the afterPack hook in
 * electron-builder.config.js (which launches the packaged binary with `--smoke-test`).
 *
 * Reaching a fully loaded renderer proves the artifact can actually boot: every main-process
 * module resolves inside app.asar, the client assets are packaged, and the window wires up.
 * Dev-mode E2E runs can't prove any of that because they resolve modules from the workspace
 * node_modules — desktop 4.12.0 shipped missing `supports-color` and crashed on every install
 * while working fine from the repo.
 *
 * Exits 0 on success, 1 on any failure, so the packaging step can fail before publishing.
 * Output is prefixed with [SMOKE TEST] for the parent process to surface in build logs.
 */
export function initializeSmokeTest(browserWindow: BrowserWindow) {
  let finished = false;

  const finish = (exitCode: number, message: string) => {
    if (finished) {
      return;
    }
    finished = true;
    console.log(`[SMOKE TEST] ${message}`);
    logger.info(`[SMOKE TEST] ${message}`);
    app.exit(exitCode);
  };

  // Electron's default uncaughtException behavior shows a dialog and keeps the process alive,
  // which would hang CI until the outer timeout instead of failing fast.
  process.on('uncaughtException', (error) => {
    finish(1, `FAILED - uncaught exception in main process: ${error.stack ?? error}`);
  });

  const timeout = setTimeout(() => {
    finish(1, `FAILED - renderer did not finish loading within ${SMOKE_TEST_TIMEOUT_MS / 1000}s`);
  }, SMOKE_TEST_TIMEOUT_MS);

  browserWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    clearTimeout(timeout);
    finish(1, `FAILED - renderer failed to load ${validatedURL}: ${errorCode} ${errorDescription}`);
  });

  browserWindow.webContents.on('render-process-gone', (_event, details) => {
    clearTimeout(timeout);
    finish(1, `FAILED - renderer process gone: ${details.reason} (exit code ${details.exitCode})`);
  });

  browserWindow.webContents.on('preload-error', (_event, preloadPath, error) => {
    clearTimeout(timeout);
    finish(1, `FAILED - preload script ${preloadPath} threw: ${error.message}`);
  });

  browserWindow.webContents.on('did-finish-load', () => {
    clearTimeout(timeout);
    finish(0, 'PASSED - main process booted and renderer finished loading');
  });
}
