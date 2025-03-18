#!/usr/bin/env node
import archiver from 'archiver';
import 'dotenv/config';
import minimist from 'minimist';
import { join } from 'path';
import { $, chalk, fs } from 'zx'; // https://github.com/google/zx

const argv = minimist(process.argv.slice(2), {
  boolean: ['help'],
  default: {
    help: false,
  },
  alias: {
    h: 'help',
  },
});

if (argv.help) {
  console.log(`
    Usage: web-extension-zip [options]

    To build new extension zip:
    node scripts/web-extension-zip.mjs --version <version>

    Options:
      -h, --help    display help for command
  `);
  process.exit(0);
}

const ZIP_INPUT_DIR = join(process.cwd(), 'dist/apps/jetstream-web-extension');
const OUTPUT_DIR = join(process.cwd(), 'dist/web-extension-build');
const OUTPUT_FILENAME = `web-extension.zip`;
const OUTPUT_PATH = join(OUTPUT_DIR, OUTPUT_FILENAME);

const SOURCE_OUTPUT_FILENAME = `web-extension-source.zip`;
const SOURCE_TEMP_DIR = join(process.cwd(), 'tmp/jetstream-web-extension-source');
const SOURCE_OUTPUT_PATH = join(OUTPUT_DIR, SOURCE_OUTPUT_FILENAME);

async function archiveDist() {
  console.log(chalk.blue(`🔥 Removing existing output directory:`), OUTPUT_DIR);

  await $`rm -rf dist/web-extension-build`;
  await $`mkdir dist/web-extension-build`;

  console.log(chalk.blue(`💾 Saving build output file to:`), OUTPUT_PATH);

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
}

async function archiveSource() {
  console.log(chalk.blue(`🔥 Cloning repo to:`), SOURCE_TEMP_DIR);
  await $`rm -rf ${SOURCE_TEMP_DIR}`;
  await $`git clone --depth 1 git@github.com:jetstreamapp/jetstream.git ${SOURCE_TEMP_DIR}`;

  console.log(chalk.blue(`💾 Saving source output file to:`), SOURCE_OUTPUT_PATH);

  const output = fs.createWriteStream(SOURCE_OUTPUT_PATH);
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

  archive.glob('**/*', {
    cwd: SOURCE_TEMP_DIR,
    ignore: ['**/.git/**', '**/node_modules/**', '**/dist/**', '**/.gitignore'],
  });

  archive.directory(SOURCE_TEMP_DIR, false);

  await archive.finalize();
}

async function main() {
  $.verbose = false;

  await archiveDist();
  await archiveSource();

  if (!fs.existsSync(OUTPUT_PATH)) {
    console.error(chalk.red('❌ Failed to create zip file'));
    process.exit(1);
  }
}

main();
