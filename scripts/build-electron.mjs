#!/usr/bin/env node
import 'dotenv/config';
import { readFileSync } from 'fs';
import minimist from 'minimist';
import { join } from 'path';
import { $, cd, chalk } from 'zx'; // https://github.com/google/zx

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
    Usage: build-electron [options]

    To build new extension zip:
    yarn build:desktop or node scripts/build-electron.mjs"

    Options:
      -h, --help    display help for command
  `);
  process.exit(0);
}

const ROOT_PACKAGE_JSON_PATH = join(process.cwd(), 'package.json');
const TARGET_DIR = join(process.cwd(), 'dist/desktop-build');
const TARGET_CLIENT_DIR = join(TARGET_DIR, 'client');
const MAIN_BUILD_DIR = join(process.cwd(), 'dist/apps/jetstream-desktop');
const DOWNZIP_SW_BUILD_DIR = join(process.cwd(), 'dist/apps/download-zip-sw');
const RENDERER_BUILD_DIR = join(process.cwd(), 'dist/apps/jetstream-desktop-client');

// NX calculates these dependencies, but they are not used in the final build
const yarnRemoveDeps = ['@prisma/client', 'react', 'tslib', 'xlsx', 'stripe'];

/**
 * Look at root package.json for version of all dependencies to install
 */
const yarnAddDevDeps = (() => {
  const { devDependencies, dependencies } = JSON.parse(readFileSync(ROOT_PACKAGE_JSON_PATH, 'utf-8'));
  const allDependencies = { ...devDependencies, ...dependencies };

  return [
    '@electron-forge/cli',
    '@electron-forge/maker-deb',
    '@electron-forge/maker-dmg',
    '@electron-forge/maker-rpm',
    '@electron-forge/maker-squirrel',
    '@electron-forge/maker-zip',
    '@electron-forge/plugin-auto-unpack-natives',
    '@electron-forge/plugin-fuses',
    '@electron/fuses',
    'electron',
  ].map((dep) => {
    const matchingDependency = Object.entries(allDependencies).find(([packageName]) => packageName === dep);
    if (!matchingDependency) {
      console.error(`${dep} not found in root package.json`);
      throw new Error(`Missing dependency: ${dep}`);
    }
    const [packageName, packageVersion] = matchingDependency;
    return `${packageName}@${packageVersion}`;
  });
})();

async function build() {
  console.log(chalk.blue(`Building and Preparing output. Target directory:`), TARGET_DIR);

  // Build app
  await $`yarn build:desktop:all`;

  // Prepare combined output target directory
  await $`rm -rf ${TARGET_DIR}`;
  await $`mkdir -p ${TARGET_DIR}`;
  await $`mkdir -p ${TARGET_CLIENT_DIR}`;

  // Copy artifacts to the target directory
  await $`cp -r ${MAIN_BUILD_DIR}/* ${TARGET_DIR}`;
  await $`cp -r ${RENDERER_BUILD_DIR}/* ${TARGET_CLIENT_DIR}`;
  await $`cp -r ${DOWNZIP_SW_BUILD_DIR}/* ${TARGET_DIR}`;
  await $`cp forge.config.js ${TARGET_DIR}`;

  cd(TARGET_DIR);

  // install dependencies
  // These MUST be dev dependencies for electron-forge to work properly and we cannot include them in the generated package.json since that only includes production dependencies
  await $`yarn add -D ${yarnAddDevDeps}`;

  // Remove extra dependencies
  // Some dependencies are pulled in because we use their types, but we don't actually need them
  await $`yarn remove ${yarnRemoveDeps}`;
  await $`rm -rf node_modules/.prisma`;

  console.log(chalk.blue(`Packaging application`));

  await $`npx electron-forge make`;
}

async function main() {
  $.verbose = true;
  await build();
}

main();
