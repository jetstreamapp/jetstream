#!/usr/bin/env node

/**
 * In-workflow Salesforce managed package release worker.
 *
 * Runs inside the `sfdx-release.yml` GitHub Action after the Dev Hub auth and
 * git identity have been configured. It:
 *   1. Bumps `versionName` / `versionNumber` in sfdx-project.json
 *   2. Creates a new package version (`sf package version create`)
 *   3. Optionally promotes it to "released"
 *   4. Commits the bump, tags `salesforce-vX.Y.Z`, and cuts a GitHub release
 *   5. Writes a rich job summary including the install URL
 *
 * Uses only Node built-ins so CI does not need to install apps-sfdx dependencies.
 *
 * Required env: BUMP (patch|minor|major), PROMOTE (true|false), SFDX_INSTALLATION_PASSWORD.
 * Optional env: REPO, GITHUB_STEP_SUMMARY, DRY_RUN (true skips all sf/git/gh side effects).
 */

import { execFileSync } from 'node:child_process';
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
// apps-sfdx root – sf commands must run here so they can locate sfdx-project.json
const sfdxProjectDir = path.resolve(scriptDir, '../..');
const sfdxProjectFile = path.join(sfdxProjectDir, 'sfdx-project.json');

const PACKAGE_NAME = 'Jetstream for Salesforce';
const TAG_PREFIX = 'salesforce-v';

const bump = requireEnv('BUMP');
const promote = process.env.PROMOTE === 'true';
const isDryRun = process.env.DRY_RUN === 'true';
const installationKey = isDryRun ? 'dry-run-key' : requireEnv('SFDX_INSTALLATION_PASSWORD');
const repo = process.env.REPO ?? 'jetstreamapp/jetstream';

if (!['patch', 'minor', 'major'].includes(bump)) {
  fail(`Invalid BUMP "${bump}". Expected one of: patch, minor, major.`);
}

// ── 1. Bump version in sfdx-project.json ────────────────────────────────────
const projectJson = JSON.parse(readFileSync(sfdxProjectFile, 'utf8'));
const defaultPackage = projectJson.packageDirectories?.find(({ package: pkg }) => pkg === PACKAGE_NAME);
if (!defaultPackage) {
  fail(`Could not find package "${PACKAGE_NAME}" in sfdx-project.json.`);
}

const version = nextVersion(defaultPackage.versionNumber, bump);
const versionString = `${version.major}.${version.minor}.${version.patch}`;
const tag = `${TAG_PREFIX}${versionString}`;

console.log(`Releasing ${PACKAGE_NAME} ${versionString} (${bump} bump from ${defaultPackage.versionNumber})`);
console.log(`Promote to released: ${promote ? 'yes' : 'no (beta)'}`);

defaultPackage.versionName = `v${versionString}`;
defaultPackage.versionNumber = `${versionString}.NEXT`;
writeFileSync(sfdxProjectFile, `${JSON.stringify(projectJson, null, 2)}\n`);

// ── 2. Create the package version ───────────────────────────────────────────
// `--json` keeps output parseable; `--code-coverage` is required to later promote.
console.log('\nCreating package version (this can take several minutes)...');
const createResult = isDryRun
  ? { result: { SubscriberPackageVersionId: '04tXXXXXXXXXXXXXXX' } }
  : JSON.parse(
      captureSf([
        'package',
        'version',
        'create',
        '--package',
        PACKAGE_NAME,
        '--installation-key',
        installationKey,
        '--code-coverage',
        '--wait',
        '90',
        '--json'
      ])
    );

const subscriberPackageVersionId = createResult?.result?.SubscriberPackageVersionId;
if (!subscriberPackageVersionId) {
  fail(`Package version create did not return a SubscriberPackageVersionId.\n${JSON.stringify(createResult, null, 2)}`);
}
console.log(`Created package version: ${subscriberPackageVersionId}`);

// ── 3. Promote (optional) ───────────────────────────────────────────────────
if (promote && !isDryRun) {
  console.log('\nPromoting package version to released...');
  captureSf(['package', 'version', 'promote', '--package', subscriberPackageVersionId, '--no-prompt', '--json']);
  console.log('Promoted.');
}

// ── 4. Commit, tag, push, GitHub release ────────────────────────────────────
if (!isDryRun) {
  console.log('\nCommitting version bump and creating tag...');
  git(['add', 'sfdx-project.json']);
  git(['commit', '-m', `chore: release salesforce ${tag.replace(TAG_PREFIX, 'v')}`]);
  git(['tag', tag]);
  git(['push', 'origin', 'HEAD']);
  git(['push', 'origin', tag]);

  console.log('Creating GitHub release...');
  exec('gh', ['release', 'create', tag, '--title', `Jetstream for Salesforce ${versionString}`, '--notes', releaseNotes()], {
    cwd: sfdxProjectDir
  });
}

// ── 5. Job summary ──────────────────────────────────────────────────────────
writeSummary();
console.log('\nDone.');

// ── Helpers ─────────────────────────────────────────────────────────────────

function installUrl() {
  return `https://login.salesforce.com/packaging/installPackage.apexp?p0=${subscriberPackageVersionId}`;
}

function releaseNotes() {
  return [
    `**Version:** ${versionString}`,
    `**Status:** ${promote ? 'Released (installable in production orgs)' : 'Beta (scratch/sandbox only)'}`,
    `**Package version id:** \`${subscriberPackageVersionId}\``,
    '',
    `**Install:** ${installUrl()}`,
    '',
    'An installation key is required to install this package.'
  ].join('\n');
}

function writeSummary() {
  const lines = [
    `## 🚀 Salesforce Managed Package Release`,
    '',
    `| Field | Value |`,
    `|-------|-------|`,
    `| Version | \`${versionString}\` |`,
    `| Bump | \`${bump}\` |`,
    `| Status | ${promote ? '✅ Released' : '🧪 Beta'} |`,
    `| Tag | [${tag}](https://github.com/${repo}/releases/tag/${tag}) |`,
    `| Package version id | \`${subscriberPackageVersionId}\` |`,
    '',
    `**Install URL:** ${installUrl()}`,
    '',
    '> An installation key is required to install.',
    ''
  ];
  const summary = lines.join('\n');
  console.log(`\n${summary}`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${summary}\n`);
  }
}

/** Parse `X.Y.Z.NEXT` (or `X.Y.Z`) and return the bumped components. */
function nextVersion(versionNumber, bumpType) {
  const [major, minor, patch] = versionNumber.split('.').map((part) => Number.parseInt(part, 10));
  if ([major, minor, patch].some((part) => Number.isNaN(part))) {
    fail(`Could not parse versionNumber "${versionNumber}". Expected "X.Y.Z.NEXT".`);
  }
  switch (bumpType) {
    case 'major':
      return { major: major + 1, minor: 0, patch: 0 };
    case 'minor':
      return { major, minor: minor + 1, patch: 0 };
    default:
      return { major, minor, patch: patch + 1 };
  }
}

function git(args) {
  exec('git', args, { cwd: sfdxProjectDir });
}

/** Run an `sf` command and return its stdout (used for `--json` output). */
function captureSf(args) {
  try {
    return execFileSync('sf', args, {
      cwd: sfdxProjectDir,
      encoding: 'utf8',
      stdio: ['inherit', 'pipe', 'inherit'],
      maxBuffer: 64 * 1024 * 1024
    });
  } catch (error) {
    // sf emits the JSON error payload on stdout even on failure
    const details = error.stdout || error.message;
    fail(`sf ${args[0]} ${args[1]} failed:\n${details}`);
  }
}

function exec(command, args, options = {}) {
  execFileSync(command, args, { stdio: 'inherit', maxBuffer: 64 * 1024 * 1024, ...options });
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    fail(`Missing required environment variable: ${name}`);
  }
  return value;
}

function fail(message) {
  console.error(`\nError: ${message}`);
  process.exit(1);
}
