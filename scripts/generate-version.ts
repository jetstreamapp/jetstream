#!/usr/bin/env node
import 'dotenv/config';
import { $, chalk, fs, path } from 'zx';

void (async function () {
  $.verbose = false;
  const VERSION = (await $`git describe --always`).stdout;
  const saveTo = path.join(__dirname, '../dist/VERSION');
  fs.ensureDirSync(path.dirname(path.join(__dirname, '../dist')));
  fs.writeFileSync(saveTo, VERSION);
  console.log('APP VERSION:', chalk.greenBright(VERSION));
})();
