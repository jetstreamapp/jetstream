#!/usr/bin/env node
/**
 * Bumps the pinned pnpm version everywhere it is hard-coded so the references never drift apart.
 *
 * Pin sites kept in sync:
 *   - package.json            -> engines.pnpm, devEngines.packageManager.version, packageManager (with corepack hash)
 *   - apps/docs/package.json  -> engines.pnpm (any range prefix like `~` is preserved), devEngines.packageManager.version
 *   - .github/workflows/*.yml -> the `version:` passed to pnpm/action-setup
 *   - Dockerfile / Dockerfile.e2e -> ARG PNPM_VERSION
 *
 * The pnpm-lock.yaml `packageManagerDependencies` block is auto-managed by pnpm, so it is refreshed by
 * running `pnpm install` at the end rather than edited by hand.
 *
 * Usage:
 *   node scripts/update-pnpm.mjs              # bump to the latest pnpm release
 *   node scripts/update-pnpm.mjs latest-11    # bump to a dist-tag (e.g. newest in the v11 line)
 *   node scripts/update-pnpm.mjs 11.5.1       # bump to an exact version
 *   node scripts/update-pnpm.mjs --check      # report current vs. target, change nothing
 *   node scripts/update-pnpm.mjs --no-install # update files but skip the lockfile refresh
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const checkOnly = args.includes('--check');
const skipInstall = args.includes('--no-install');
const requestedSpec = args.find((arg) => !arg.startsWith('--')) ?? 'latest';

// Matches a semver version, optionally with a prerelease suffix. Wrapped in a non-capturing group so it
// can be embedded in larger patterns without shifting capture-group indexes.
const VERSION = String.raw`\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?`;

async function fetchJson(url) {
  const response = await fetch(url, { headers: { accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`Request to ${url} failed with status ${response.status}`);
  }
  return response.json();
}

/**
 * Resolves a version spec (an exact version or a dist-tag such as `latest` / `latest-11`) into a concrete
 * version plus the corepack integrity hash. corepack stores the npm `sha512-<base64>` integrity as a hex
 * digest in the form `pnpm@<version>+sha512.<hex>`, so we convert it here.
 */
async function resolvePnpm(spec) {
  const distTags = await fetchJson('https://registry.npmjs.org/-/package/pnpm/dist-tags');
  const version = distTags[spec] ?? spec;

  const release = await fetchJson(`https://registry.npmjs.org/pnpm/${version}`);
  if (!release?.dist?.integrity) {
    throw new Error(`pnpm version "${spec}" could not be resolved on the npm registry`);
  }
  const hash = Buffer.from(release.dist.integrity.replace(/^sha512-/, ''), 'base64').toString('hex');
  return { version, hash };
}

/**
 * Applies a replacement and verifies it actually matched, so a drift in any file's format fails loudly
 * instead of silently leaving a stale pin behind. `expected` null means "at least one match required".
 */
function replaceOrThrow(text, regex, replacer, description, expected = null) {
  let count = 0;
  const result = text.replace(regex, (...groups) => {
    count += 1;
    return replacer(...groups);
  });
  if (expected != null && count !== expected) {
    throw new Error(`Expected ${expected} replacement(s) for "${description}" but made ${count}. Has the file format changed?`);
  }
  if (expected == null && count === 0) {
    throw new Error(`No replacement made for "${description}". Has the file format changed?`);
  }
  return result;
}

function buildFileEditors(version, hash) {
  const enginesPnpm = (text, description) =>
    replaceOrThrow(
      text,
      new RegExp(String.raw`("pnpm":\s*")([~^]?)${VERSION}(")`),
      (_match, prefix, range, suffix) => `${prefix}${range}${version}${suffix}`,
      description,
      1
    );

  const devEnginesVersion = (text, description) =>
    replaceOrThrow(
      text,
      new RegExp(String.raw`("name":\s*"pnpm",\s*"version":\s*")${VERSION}(")`),
      (_match, prefix, suffix) => `${prefix}${version}${suffix}`,
      description,
      1
    );

  const actionSetupVersion = (text) =>
    replaceOrThrow(
      text,
      new RegExp(String.raw`(uses:\s*pnpm/action-setup@[^\n]*\n(?:[^\n]*\n)*?[ \t]*version:\s*)${VERSION}`, 'g'),
      (_match, prefix) => `${prefix}${version}`,
      'pnpm/action-setup version'
    );

  const dockerArg = (text) =>
    replaceOrThrow(
      text,
      new RegExp(String.raw`(ARG PNPM_VERSION=)${VERSION}`),
      (_match, prefix) => `${prefix}${version}`,
      'ARG PNPM_VERSION',
      1
    );

  return {
    'package.json': (text) => {
      text = enginesPnpm(text, 'package.json engines.pnpm');
      text = devEnginesVersion(text, 'package.json devEngines version');
      return replaceOrThrow(
        text,
        new RegExp(String.raw`("packageManager":\s*"pnpm@)${VERSION}(\+sha512\.)[0-9a-f]+(")`),
        (_match, prefix, hashPrefix, suffix) => `${prefix}${version}${hashPrefix}${hash}${suffix}`,
        'package.json packageManager',
        1
      );
    },
    'apps/docs/package.json': (text) => {
      text = enginesPnpm(text, 'apps/docs/package.json engines.pnpm');
      return devEnginesVersion(text, 'apps/docs/package.json devEngines version');
    },
    '.github/workflows/ci.yml': actionSetupVersion,
    '.github/workflows/release.yml': actionSetupVersion,
    '.github/workflows/docs.yml': actionSetupVersion,
    Dockerfile: dockerArg,
    'Dockerfile.e2e': dockerArg,
  };
}

function readCurrentVersion() {
  const pkg = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8'));
  return pkg.engines?.pnpm ?? 'unknown';
}

async function main() {
  const currentVersion = readCurrentVersion();
  const { version, hash } = await resolvePnpm(requestedSpec);

  console.log(`Current pnpm: ${currentVersion}`);
  console.log(`Target pnpm:  ${version} (resolved from "${requestedSpec}")`);

  if (checkOnly) {
    const upToDate = currentVersion === version;
    console.log(upToDate ? '\n✓ Already up to date.' : '\nRun without --check to apply the update.');
    return;
  }

  const editors = buildFileEditors(version, hash);
  const changedFiles = [];

  for (const [relativePath, editFile] of Object.entries(editors)) {
    const filePath = join(repoRoot, relativePath);
    const original = readFileSync(filePath, 'utf8');
    const updated = editFile(original);
    if (updated !== original) {
      writeFileSync(filePath, updated);
      changedFiles.push(relativePath);
    }
  }

  if (changedFiles.length === 0) {
    console.log('\n✓ All references already point at the target version. Nothing to change.');
    return;
  }

  console.log(`\nUpdated ${changedFiles.length} file(s):`);
  for (const file of changedFiles) {
    console.log(`  - ${file}`);
  }

  if (skipInstall) {
    console.log('\nSkipped lockfile refresh (--no-install). Run `pnpm install` to update pnpm-lock.yaml.');
    return;
  }

  console.log('\nRefreshing pnpm-lock.yaml via `pnpm install --lockfile-only`...');
  try {
    execFileSync('pnpm', ['install', '--lockfile-only'], { cwd: repoRoot, stdio: 'inherit' });
  } catch {
    console.warn('\n⚠ Could not run `pnpm install` automatically. Run it manually to refresh pnpm-lock.yaml.');
  }
}

main().catch((error) => {
  console.error(`\n✗ ${error.message}`);
  process.exit(1);
});
