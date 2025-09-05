#!/usr/bin/env node
import 'dotenv/config';
import { readFileSync, writeFileSync } from 'fs';
import { copy, ensureDir, remove } from 'fs-extra';
import minimist from 'minimist';
import { join } from 'path';
import { $, cd, chalk, usePowerShell } from 'zx'; // https://github.com/google/zx

// Configure shell based on platform
if (process.platform === 'win32') {
  usePowerShell(); // Use PowerShell on Windows
}

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

const TARGET_DIR = join(process.cwd(), 'dist/desktop-build');
const ROOT_PACKAGE_JSON_PATH = join(process.cwd(), 'package.json');
const TARGET_PACKAGE_JSON_PATH = join(TARGET_DIR, 'package.json');
const TARGET_CLIENT_DIR = join(TARGET_DIR, 'client');
const MAIN_BUILD_DIR = join(process.cwd(), 'dist/apps/jetstream-desktop');
const DOWNZIP_SW_BUILD_DIR = join(process.cwd(), 'dist/apps/download-zip-sw');
const RENDERER_BUILD_DIR = join(process.cwd(), 'dist/apps/jetstream-desktop-client');

// NX calculates these dependencies, but they are not used in the final build
const yarnRemoveDeps = () => {
  const { devDependencies, dependencies } = JSON.parse(readFileSync(TARGET_PACKAGE_JSON_PATH, 'utf-8'));
  const allDependencies = { ...devDependencies, ...dependencies };
  console.log(allDependencies);
  return ['react', 'tslib', 'xlsx', 'stripe'].filter((dep) => {
    const matchingDependency = Object.entries(allDependencies).find(([packageName]) => packageName === dep);
    if (!matchingDependency) {
      console.warn(`${dep} not found in root package.json, skipping removal`);
    }
    return matchingDependency;
  });
};

/**
 * Look at root package.json for version of all dependencies to install
 * This enabled us to avoid having to keep the version numbers in sync manually
 */
const yarnAddDevDeps = () => {
  const { devDependencies, dependencies } = JSON.parse(readFileSync(ROOT_PACKAGE_JSON_PATH, 'utf-8'));
  const allDependencies = { ...devDependencies, ...dependencies };
  return [
    '@electron-forge/cli',
    '@electron-forge/maker-deb',
    '@electron-forge/maker-dmg',
    '@electron-forge/maker-pkg',
    '@electron-forge/maker-rpm',
    '@electron-forge/maker-squirrel',
    '@electron-forge/maker-zip',
    '@electron-forge/plugin-auto-unpack-natives',
    '@electron-forge/plugin-fuses',
    '@electron-forge/publisher-github',
    '@electron-forge/publisher-s3',
    '@electron/fuses',
    'dotenv',
    'electron',
    'ts-node',
    'typescript',
  ].map((dep) => {
    const matchingDependency = Object.entries(allDependencies).find(([packageName]) => packageName === dep);
    if (!matchingDependency) {
      console.error(`${dep} not found in root package.json`);
      throw new Error(`Missing dependency: ${dep}`);
    }
    const [packageName, packageVersion] = matchingDependency;
    return `${packageName}@${packageVersion}`;
  });
};

async function build() {
  console.log(chalk.blue(`Building and Preparing output. Target directory:`), TARGET_DIR);

  // Build app
  await $`yarn build:desktop:all`;

  // Prepare combined output target directory
  await remove(TARGET_DIR);
  await ensureDir(TARGET_DIR);
  await ensureDir(TARGET_CLIENT_DIR);

  // Copy artifacts to the target directory
  await copy(MAIN_BUILD_DIR, TARGET_DIR);
  await copy(RENDERER_BUILD_DIR, TARGET_CLIENT_DIR);
  await copy(DOWNZIP_SW_BUILD_DIR, TARGET_DIR);

  await copy('forge.config.ts', join(TARGET_DIR, 'forge.config.ts'));
  await copy('LICENSE.md', join(TARGET_DIR, 'LICENSE.md'));

  cd(TARGET_DIR);

  // install dependencies
  // These MUST be dev dependencies for electron-forge to work properly and we cannot include them in the generated package.json since that only includes production dependencies
  await $`yarn add -D ${yarnAddDevDeps()}`;

  // Remove extra dependencies
  // Some dependencies are pulled in because we use their types, but we don't actually need them
  await $`yarn remove ${yarnRemoveDeps()}`;
  await remove(join(TARGET_DIR, 'node_modules/.prisma'));

  const envContent = [
    'IS_CODESIGNING_ENABLED',
    'APPLE_ID',
    'APPLE_PASSWORD',
    'APPLE_TEAM_ID',
    'BACKBLAZE_ACCESS_KEY_ID',
    'BACKBLAZE_SECRET_ACCESS_KEY',
  ]
    .filter((key) => process.env[key])
    .map((key) => `${key}=${process.env[key] ?? ''}`)
    .join('\n');
  writeFileSync('.env', envContent);
}

async function main() {
  $.verbose = true;
  await build();
}

main();
