#!/usr/bin/env node

/**
 * Point `jetstream://` deep links at this checkout's dev Electron (macOS only).
 *
 * In dev the desktop app runs inside the stock Electron.app from node_modules, and every worktree has its own copy
 * sharing the bundle id `com.github.Electron`. LaunchServices then routes deep links (e.g. the post-login callback)
 * to whichever copy it prefers, which is often another worktree's - that copy launches with no app loaded and shows
 * Electron's default "To run a local app..." window.
 *
 * This unregisters every other Electron.app copy across this repo's worktrees and force-registers this checkout's.
 * It runs before `pnpm start:desktop` and can be run by hand with `pnpm desktop:deeplink`. It never fails the caller.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const LSREGISTER = '/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister';

if (process.platform !== 'darwin') {
  process.exit(0);
}

try {
  const repoRoot = path.resolve(import.meta.dirname, '..');
  const targetApp = getElectronAppPath(repoRoot);
  if (!targetApp) {
    console.warn('[desktop-deeplink] Electron is not installed in this checkout - run `pnpm install`.');
    process.exit(0);
  }

  // Includes this checkout: switching branches can leave copies of other Electron versions in its own store
  const otherApps = getWorktreePaths(repoRoot)
    .flatMap(findElectronApps)
    .filter((appPath) => appPath !== targetApp);

  for (const appPath of otherApps) {
    // Fails harmlessly when the copy was never registered
    runLsregister(['-u', appPath]);
  }
  runLsregister(['-f', targetApp]);

  console.log(`[desktop-deeplink] jetstream:// -> ${path.relative(repoRoot, targetApp)}`);
} catch (error) {
  console.warn(`[desktop-deeplink] Could not register deep link handler: ${error.message}`);
}

/** `require('electron')` resolves to the binary inside Electron.app; walk up to the bundle */
function getElectronAppPath(repoRoot) {
  try {
    const electronBinary = createRequire(path.join(repoRoot, 'package.json'))('electron');
    const appPath = electronBinary.slice(0, electronBinary.indexOf('.app/') + '.app'.length);
    return appPath.endsWith('.app') && existsSync(appPath) ? appPath : null;
  } catch {
    return null;
  }
}

function getWorktreePaths(repoRoot) {
  const output = execFileSync('git', ['-C', repoRoot, 'worktree', 'list', '--porcelain'], { encoding: 'utf8' });
  return output
    .split('\n')
    .filter((line) => line.startsWith('worktree '))
    .map((line) => path.resolve(line.slice('worktree '.length)));
}

function findElectronApps(worktreePath) {
  const pnpmStore = path.join(worktreePath, 'node_modules', '.pnpm');
  if (!existsSync(pnpmStore)) {
    return [];
  }
  return readdirSync(pnpmStore)
    .filter((entry) => entry.startsWith('electron@'))
    .map((entry) => path.join(pnpmStore, entry, 'node_modules', 'electron', 'dist', 'Electron.app'))
    .filter((appPath) => existsSync(appPath));
}

function runLsregister(args) {
  try {
    execFileSync(LSREGISTER, args, { stdio: 'ignore' });
  } catch {
    // lsregister exits non-zero for paths it does not know about
  }
}
