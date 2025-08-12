import { spawn } from 'child_process';
import { app } from 'electron';
import logger from 'electron-log';
import path from 'path';

// Copied and slightly modified from https://github.com/mongodb-js/electron-squirrel-startup
// Returns true if an install/update is happening and the app will end up quitting in that case

function run(args: string[], done: () => void) {
  const updateExe = path.resolve(path.dirname(process.execPath), '..', 'Update.exe');
  logger.debug('Spawning `%s` with args `%s`', updateExe, args);
  spawn(updateExe, args, {
    detached: true,
  }).on('close', done);
}

export function handleSquirrelEvent(): boolean {
  if (process.platform !== 'win32') {
    return false;
  }
  const cmd = process.argv[1];
  logger.debug('processing squirrel command `%s`', cmd);
  const target = path.basename(process.execPath);

  if (cmd === '--squirrel-install' || cmd === '--squirrel-updated') {
    run([`--createShortcut=${target}`], app.quit);
    return true;
  }

  if (cmd === '--squirrel-uninstall') {
    run([`--removeShortcut=${target}`], app.quit);
    return true;
  }

  if (cmd === '--squirrel-obsolete') {
    app.quit();
    return true;
  }
  return false;
}
