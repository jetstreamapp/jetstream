#!/usr/bin/env node

/**
 * Align a hotfix branch's version files with what has already been released,
 * before release-it bumps them.
 *
 * Hotfix branches are cut from `origin/release`, which tracks the commit running in
 * production for the *web* application. The web extension and desktop app are tagged
 * from their own commits on main, so their version files on a hotfix branch are
 * routinely behind what has already shipped. Bumping from the stale file publishes a
 * downgrade — e.g. a hotfix branch at extension 3.7.1 releases 3.7.2 while 3.8.0 is
 * already in the store — so each file is first fast-forwarded to its highest tag.
 *
 * Any file that changes is committed so release-it starts from a clean tree.
 *
 * Usage: node scripts/sync-hotfix-versions.mjs
 * Env:   RELEASE_WEB / RELEASE_WEB_EXTENSION / RELEASE_DESKTOP — "true" to include a platform
 */

import { $, chalk } from 'zx';
import { RELEASE_TARGETS, resolveBaseVersion, writeVersion } from './lib/release-versions.mjs';

$.verbose = false;

const PLATFORM_ENV_VAR = {
  web: 'RELEASE_WEB',
  extension: 'RELEASE_WEB_EXTENSION',
  desktop: 'RELEASE_DESKTOP',
};

const selectedTargets = RELEASE_TARGETS.filter((target) => process.env[PLATFORM_ENV_VAR[target.key]] === 'true');
if (!selectedTargets.length) {
  console.log('No platforms selected — nothing to sync.');
  process.exit(0);
}

const syncedTargets = [];
for (const target of selectedTargets) {
  const { fileVersion, taggedVersion, isStale } = await resolveBaseVersion(target);
  if (!isStale) {
    console.log(`${target.label}: ${fileVersion} is current`);
    continue;
  }
  await writeVersion(target, taggedVersion);
  syncedTargets.push({ target, fileVersion, taggedVersion });
  console.log(chalk.yellow(`${target.label}: ${fileVersion} → ${taggedVersion} (already released as ${target.tagPrefix}${taggedVersion})`));
}

if (!syncedTargets.length) {
  console.log(chalk.green('\nAll version files already match the latest release tags.'));
  process.exit(0);
}

const summary = syncedTargets
  .map(({ target, fileVersion, taggedVersion }) => `${target.label} ${fileVersion} → ${taggedVersion}`)
  .join(', ');

await $`git add ${syncedTargets.map(({ target }) => target.versionFile)}`;
await $`git commit -m ${`chore: sync hotfix version files with released versions (${summary})`}`;

console.log(chalk.green('\nCommitted version sync — release-it will bump from the released versions.'));
