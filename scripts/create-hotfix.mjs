#!/usr/bin/env node

/**
 * Create a hotfix branch from the most recently deployed web release.
 *
 * Anchors on origin/release HEAD — the release workflow force-pushes
 * origin/release to whichever ref triggered the current web release, so that
 * commit is exactly what is running in production. The matching v* tag is
 * surfaced for confirmation.
 *
 * After running this script:
 *   1. Commit the fix on the new hotfix/* branch
 *   2. Push and trigger the release workflow from the branch (`yarn release`)
 *   3. After release, merge the hotfix branch back to main via PR
 *
 * Usage: node scripts/create-hotfix.mjs
 */

import { confirm, input } from '@inquirer/prompts';
import { $, chalk } from 'zx';

$.verbose = false;

const REMOTE = 'origin';

function die(message) {
  console.error(chalk.red(`\n${message}\n`));
  process.exit(1);
}

// ── Header ─────────────────────────────────────────────────────────────────
console.log('\n' + chalk.bold.cyan('  Jetstream Hotfix') + '\n');

// ── Pre-flight: clean working tree ─────────────────────────────────────────
const dirty = (await $`git status --porcelain`).stdout.trim();
if (dirty) {
  die('Working tree is dirty. Commit or stash your changes before creating a hotfix branch.');
}

// ── Fetch release branch and tags ──────────────────────────────────────────
process.stdout.write(chalk.dim('Fetching release branch and tags... '));
try {
  await $`git fetch ${REMOTE} release --tags --prune --quiet`;
  console.log(chalk.green('done'));
} catch (error) {
  console.log(chalk.red('failed'));
  die(`Could not fetch ${REMOTE}/release. ${error.message ?? ''}`);
}

// ── Resolve the deployed commit ────────────────────────────────────────────
const deployedSha = (await $`git rev-parse ${REMOTE}/release`).stdout.trim();
const deployedShort = deployedSha.slice(0, 9);
const deployedMessage = (await $`git log -1 --format=%s ${deployedSha}`).stdout.trim();
const deployedDate = (await $`git log -1 --format=%cI ${deployedSha}`).stdout.trim();

// to the web app. Use Git's version-aware tag sorting so prereleases sort
// lower than the corresponding stable release.
const tagsAtShaRaw = (
  await $`git tag --points-at ${deployedSha} --list 'v[0-9]*' --sort=-v:refname`
).stdout.trim();
const webTags = tagsAtShaRaw
  .split('\n')
  .map((tag) => tag.trim())
  .filter(Boolean);

// When multiple v* tags point at the same commit, Git returns the highest
// version tag first.
const webTag = webTags[0];

if (!webTag) {
  console.log(chalk.yellow(`\nWarning: No web release tag (v*) found at ${deployedShort}.`));
  console.log(chalk.yellow('The release branch may not point at a released commit. Proceed with caution.\n'));
}

console.log('');
console.log(chalk.bold('  Currently deployed (web)'));
console.log(chalk.dim('  ─────────────────────────'));
console.log(`  ${chalk.dim('tag')}      ${webTag ? chalk.cyan(webTag) : chalk.dim('(none)')}`);
console.log(`  ${chalk.dim('commit')}   ${chalk.cyan(deployedShort)}`);
console.log(`  ${chalk.dim('message')}  ${deployedMessage}`);
console.log(`  ${chalk.dim('date')}     ${chalk.dim(deployedDate)}`);
console.log('');

// ── Prompt: hotfix branch name ─────────────────────────────────────────────
const rawName = await input({
  message: 'Hotfix branch name (will be prefixed with hotfix/)',
  validate(value) {
    const trimmed = value.trim().replace(/^hotfix\//, '');
    if (!trimmed) {
      return 'Branch name is required';
    }
    if (!/^[A-Za-z0-9._\-/]+$/.test(trimmed)) {
      return 'Branch name contains invalid characters';
    }
    return true;
  },
});

const branchName = `hotfix/${rawName.trim().replace(/^hotfix\//, '')}`;

// ── Guard: existing branch ─────────────────────────────────────────────────
try {
  await $`git rev-parse --verify ${branchName}`.quiet();
  die(`Branch "${branchName}" already exists locally.`);
} catch {
  // Expected: branch does not exist
}

// ── Confirm ────────────────────────────────────────────────────────────────
console.log('');
console.log(chalk.bold('  Create branch'));
console.log(chalk.dim('  ─────────────────────────'));
console.log(`  ${chalk.dim('name')}    ${chalk.cyan(branchName)}`);
console.log(`  ${chalk.dim('from')}    ${chalk.cyan(webTag ?? deployedShort)}`);
console.log('');

const ok = await confirm({ message: 'Create hotfix branch?', default: true });
if (!ok) {
  console.log(chalk.yellow('\nAborted.'));
  process.exit(0);
}

// ── Create branch ──────────────────────────────────────────────────────────
await $`git checkout -b ${branchName} ${deployedSha}`;
console.log(chalk.green(`\n✓ Created ${branchName} at ${deployedShort}`));

console.log('');
console.log(chalk.dim('  Next steps:'));
console.log(chalk.dim('  1. Implement and commit the fix on this branch'));
console.log(chalk.dim('  2. Push the branch: ') + chalk.cyan(`git push -u ${REMOTE} ${branchName}`));
console.log(chalk.dim('  3. Trigger a web release from this branch: ') + chalk.cyan('yarn release'));
console.log(chalk.dim('  4. After release, merge the hotfix branch back to main via PR'));
console.log('');
