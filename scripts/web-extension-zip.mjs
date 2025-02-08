#!/usr/bin/env node
import archiver from 'archiver';
import 'dotenv/config';
import minimist from 'minimist';
import { join } from 'path';
import { $, chalk, fs } from 'zx'; // https://github.com/google/zx

const argv = minimist(process.argv.slice(2), {
  boolean: ['help'],
  string: ['version'],
  default: {
    help: false,
  },
  alias: {
    h: 'help',
    v: 'version',
  },
});

if (argv.help) {
  console.log(`
    Usage: web-extension-zip [options]

    To build new extension zip:
    node scripts/web-extension-zip.mjs --version <version>

    Options:
      -c, --version version number to use for zip file
      -h, --help    display help for command
  `);
  process.exit(0);
}

const version = argv.version;
if (!version) {
  console.error(chalk.red('--version must be provided'));
  process.exit(1);
}

const ZIP_INPUT_DIR = join(process.cwd(), 'dist/apps/jetstream-web-extension');
const OUTPUT_DIR = join(process.cwd(), 'dist/web-extension-build');
const OUTPUT_FILENAME = `web-ext-${version}.zip`;
const OUTPUT_PATH = join(OUTPUT_DIR, OUTPUT_FILENAME);

async function main() {
  console.log(chalk.blue(`🔥 Removing existing output directory:`), OUTPUT_DIR);

  $.verbose = false;

  await $`rm -rf dist/web-extension-build`;
  await $`mkdir dist/web-extension-build`;

  console.log(chalk.blue(`💾 Saving output file to:`), OUTPUT_PATH);

  const output = fs.createWriteStream(OUTPUT_PATH);
  const archive = archiver('zip', {
    zlib: { level: 9 },
  });

  output.on('close', function () {
    console.log(chalk.green(`✅ Zip file created successfully. ${chalk.yellow(`${Math.floor(archive.pointer() / 1024 / 10) / 100} MB`)}`));
  });

  archive.on('error', (err) => {
    throw err;
  });

  archive.pipe(output);
  archive.directory(ZIP_INPUT_DIR, false);
  await archive.finalize();

  if (!fs.existsSync(OUTPUT_PATH)) {
    console.error(chalk.red('❌ Failed to create zip file'));
    process.exit(1);
  }
}

main();
