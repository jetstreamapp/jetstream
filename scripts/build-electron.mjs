#!/usr/bin/env node
import 'dotenv/config';
import { readFileSync, writeFileSync } from 'fs';
import { copy, ensureDir, remove } from 'fs-extra';
import yaml from 'js-yaml';
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
    Usage: build-electron [options]

    To build new electron app:
    pnpm build:desktop or node scripts/build-electron.mjs

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
const ROOT_PNPM_WORKSPACE_PATH = join(process.cwd(), 'pnpm-workspace.yaml');
const TARGET_PACKAGE_JSON_PATH = join(TARGET_DIR, 'package.json');
const TARGET_PNPM_WORKSPACE_PATH = join(TARGET_DIR, 'pnpm-workspace.yaml');
const TARGET_CLIENT_DIR = join(TARGET_DIR, 'client');
const MAIN_BUILD_DIR = join(process.cwd(), 'dist/apps/jetstream-desktop');
const RENDERER_BUILD_DIR = join(process.cwd(), 'dist/apps/jetstream-desktop-client');
// NX calculates these dependencies, but they are not used in the final build
const packageManagerRemoveDeps = () => {
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
const packageManagerAddDevDeps = () => {
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

const packageManagerAddProdDeps = () => {
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

function prepareTargetPackageJson() {
  const rootPackageJson = JSON.parse(readFileSync(ROOT_PACKAGE_JSON_PATH, 'utf-8'));
  const rootWorkspace = yaml.load(readFileSync(ROOT_PNPM_WORKSPACE_PATH, 'utf-8')) ?? {};
  const targetPackageJson = JSON.parse(readFileSync(TARGET_PACKAGE_JSON_PATH, 'utf-8'));

  targetPackageJson.engines = rootPackageJson.engines;
  targetPackageJson.devEngines = rootPackageJson.devEngines;

  writeFileSync(TARGET_PACKAGE_JSON_PATH, JSON.stringify(targetPackageJson, null, 2) + '\n');

  // Inherit root pnpm-workspace.yaml settings but reset `packages` to an empty list so
  // TARGET_DIR becomes a self-contained workspace root with no nested member packages.
  // This isolates the subsequent `pnpm add` calls from the parent repo's workspace/lockfile.
  const targetWorkspace = { ...rootWorkspace, packages: [] };
  writeFileSync(TARGET_PNPM_WORKSPACE_PATH, yaml.dump(targetWorkspace));
}

async function build() {
  console.log(chalk.blue(`Building and Preparing output. Target directory:`), TARGET_DIR);

  // Build app
  await $`pnpm build:desktop:all`;

  // Prepare combined output target directory
  await remove(TARGET_DIR);
  await ensureDir(TARGET_DIR);
  await ensureDir(TARGET_CLIENT_DIR);

  // Copy artifacts to the target directory
  await copy(MAIN_BUILD_DIR, TARGET_DIR);
  await copy(RENDERER_BUILD_DIR, TARGET_CLIENT_DIR);

  // Copy electron-builder config and assets
  await copy('electron-builder.config.js', join(TARGET_DIR, 'electron-builder.config.js'));
  await copy('DESKTOP_EULA.md', join(TARGET_DIR, 'DESKTOP_EULA.md'));
  prepareTargetPackageJson();

  cd(TARGET_DIR);

  // Install missing dependencies. The local pnpm-workspace.yaml written above
  // makes TARGET_DIR its own workspace root, so these installs stay isolated
  // from the root project's lockfile.
  console.log(chalk.blue('Installing dependencies...'));
  await $`pnpm add -D ${packageManagerAddDevDeps()}`; // this is required to be first because postInstall script depends on it
  await $`pnpm add ${packageManagerAddProdDeps()}`;

  // Remove extra dependencies
  console.log(chalk.blue('Removing unnecessary dependencies...'));
  const depsToRemove = packageManagerRemoveDeps();
  if (depsToRemove.length > 0) {
    await $`pnpm remove ${depsToRemove}`;
  }

  // Clean up unnecessary files
  await remove(join(TARGET_DIR, 'node_modules/.prisma'));
  await remove(join(TARGET_DIR, 'node_modules/.cache'));

  // Create .env file with the secrets electron-builder needs at package/publish time.
  // Resolve values up front so the Backblaze->AWS fallback below is based on actual
  // env values rather than substring-matching the serialized file content.
  const envValues = {};
  for (const key of [
    'IS_CODESIGNING_ENABLED',
    'APPLE_TEAM_ID',
    'APPLE_API_KEY',
    'APPLE_API_KEY_ID',
    'APPLE_API_ISSUER',
    'PROVISIONING_PROFILE_PATH_DARWIN',
    'PROVISIONING_PROFILE_PATH_MAS',
    'AZURE_TENANT_ID',
    'AZURE_CLIENT_ID',
    'AZURE_CLIENT_SECRET',
    'BACKBLAZE_ACCESS_KEY_ID',
    'BACKBLAZE_SECRET_ACCESS_KEY',
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
  ]) {
    if (process.env[key]) {
      envValues[key] = process.env[key];
    }
  }

  // electron-builder publishes to the S3-compatible Backblaze bucket via the AWS_*
  // credentials, so fall back to the Backblaze keys when AWS_* aren't provided.
  envValues.AWS_ACCESS_KEY_ID ??= process.env.BACKBLAZE_ACCESS_KEY_ID;
  envValues.AWS_SECRET_ACCESS_KEY ??= process.env.BACKBLAZE_SECRET_ACCESS_KEY;

  // Serialize as a double-quoted value, escaping the backslash (the escape char)
  // first so the remaining escapes are unambiguous, then newlines and quotes. This
  // keeps secrets containing spaces, '#', quotes, or newlines from corrupting the file.
  const serializeEnvValue = (value) =>
    `"${String(value).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/"/g, '\\"')}"`;

  const envContent = Object.entries(envValues)
    .filter(([, value]) => value != null)
    .map(([key, value]) => `${key}=${serializeEnvValue(value)}`)
    .join('\n');

  // Restrict permissions; this file contains signing and publishing secrets.
  writeFileSync('.env', envContent + '\n', { mode: 0o600 });

  // Build with electron-builder
  console.log(chalk.green('Ready to build with electron-builder!'));
  console.log(chalk.green('Publish your artifacts by running:'));
  console.log(chalk.blue('cd dist/desktop-build && pnpm publish:mac'));
  console.log(chalk.blue('cd dist/desktop-build; pnpm publish:win'));
}

async function main() {
  $.verbose = true;
  await build();
}

main();
