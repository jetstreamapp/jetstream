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
  boolean: ['help', 'publish'],
  string: ['platform', 'arch'],
  default: {
    help: false,
    publish: false,
    platform: process.platform,
    arch: process.arch,
  },
  alias: {
    h: 'help',
    p: 'publish',
  },
});

if (argv.help) {
  console.log(`
    Usage: build-electron-builder [options]

    To build new electron app:
    yarn build:desktop:builder or node scripts/build-electron-builder.mjs"

    Options:
      -h, --help       display help for command
      -p, --publish    publish to configured destination
      --platform       target platform (darwin, win32, linux)
      --arch           target architecture (x64, arm64)
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
const WINDOWS_SIGN_SCRIPT = join(process.cwd(), 'scripts/windows-sign.js');
const WINDOWS_SIGN_SCRIPT_DEST = join(TARGET_DIR, 'windows-sign.js');

// NX calculates these dependencies, but they are not used in the final build
const yarnRemoveDeps = () => {
  const { devDependencies, dependencies } = JSON.parse(readFileSync(TARGET_PACKAGE_JSON_PATH, 'utf-8'));
  const allDependencies = { ...devDependencies, ...dependencies };

  return ['react', 'tslib', 'xlsx', 'stripe'].filter((dep) => {
    const matchingDependency = Object.entries(allDependencies).find(([packageName]) => packageName === dep);
    if (!matchingDependency) {
      console.warn(`${dep} not found in package.json, skipping removal`);
    }
    return matchingDependency;
  });
};

/**
 * Look at root package.json for version of all dependencies to install
 * This enables us to avoid having to keep the version numbers in sync manually
 */
const yarnAddDevDeps = () => {
  const { devDependencies, dependencies } = JSON.parse(readFileSync(ROOT_PACKAGE_JSON_PATH, 'utf-8'));
  const allDependencies = { ...devDependencies, ...dependencies };

  return [
    // electron-builder and related packages
    'electron-builder',
    '@electron/notarize',
    '@electron/fuses',
    // Build utilities
    'dotenv',
    'electron',
    'ts-node',
    'typescript',
  ].map((dep) => {
    const matchingDependency = Object.entries(allDependencies).find(([packageName]) => packageName === dep);
    if (!matchingDependency) {
      // For packages not in root, use latest
      console.warn(`${dep} not found in root package.json, will install latest version`);
      return dep;
    }
    const [packageName, packageVersion] = matchingDependency;
    return `${packageName}@${packageVersion}`;
  });
};

const yarnAddProdDeps = () => {
  const { devDependencies, dependencies } = JSON.parse(readFileSync(ROOT_PACKAGE_JSON_PATH, 'utf-8'));
  const allDependencies = { ...devDependencies, ...dependencies };

  return ['electron-updater'].map((dep) => {
    const matchingDependency = Object.entries(allDependencies).find(([packageName]) => packageName === dep);
    if (!matchingDependency) {
      // For packages not in root, use latest
      console.warn(`${dep} not found in root package.json, will install latest version`);
      return dep;
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
  await copy(WINDOWS_SIGN_SCRIPT, WINDOWS_SIGN_SCRIPT_DEST);

  // Copy electron-builder config and assets
  await copy('electron-builder.config.js', join(TARGET_DIR, 'electron-builder.config.js'));
  await copy('DESKTOP_EULA.md', join(TARGET_DIR, 'DESKTOP_EULA.md'));

  cd(TARGET_DIR);

  // Install missing dependencies
  console.log(chalk.blue('Installing dependencies...'));
  await $`yarn add -D ${yarnAddDevDeps()}`; // this is required to be first because postInstall script depends on it
  await $`yarn add ${yarnAddProdDeps()}`;

  // Remove extra dependencies
  console.log(chalk.blue('Removing unnecessary dependencies...'));
  const depsToRemove = yarnRemoveDeps();
  if (depsToRemove.length > 0) {
    await $`yarn remove ${depsToRemove}`;
  }

  // Clean up unnecessary files
  await remove(join(TARGET_DIR, 'node_modules/.prisma'));
  await remove(join(TARGET_DIR, 'node_modules/.cache'));

  // Create .env file with necessary environment variables
  let envContent = [
    'IS_CODESIGNING_ENABLED',
    'APPLE_TEAM_ID',
    'APPLE_API_KEY',
    'APPLE_API_KEY_ID',
    'APPLE_API_ISSUER',
    'PROVISIONING_PROFILE_PATH_DARWIN',
    'PROVISIONING_PROFILE_PATH_MAS',
    'WINDOWS_CERT_SHA1',
    'BACKBLAZE_ACCESS_KEY_ID',
    'BACKBLAZE_SECRET_ACCESS_KEY',
    // Optional, will fall back to Backblaze keys if not provided
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
  ]
    .filter((key) => process.env[key])
    .map((key) => `${key}=${process.env[key] ?? ''}`)
    .join('\n');

  if (envContent.includes('BACKBLAZE_ACCESS_KEY_ID') && !envContent.includes('AWS_ACCESS_KEY_ID')) {
    envContent += `\nAWS_ACCESS_KEY_ID=${process.env.BACKBLAZE_ACCESS_KEY_ID}`;
  }
  if (envContent.includes('BACKBLAZE_SECRET_ACCESS_KEY') && !envContent.includes('AWS_SECRET_ACCESS_KEY')) {
    envContent += `\nAWS_SECRET_ACCESS_KEY=${process.env.BACKBLAZE_SECRET_ACCESS_KEY}`;
  }

  writeFileSync('.env', envContent);

  // Build with electron-builder
  console.log(chalk.green('Ready to build with electron-builder!'));
  console.log(chalk.green('Publish your artifacts by running:'));
  console.log(chalk.blue('cd dist/desktop-build && yarn publish:mac'));
  console.log(chalk.blue('cd dist/desktop-build && yarn publish:win'));
}

async function main() {
  $.verbose = true;
  await build();
}

main();
