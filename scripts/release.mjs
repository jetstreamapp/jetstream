#!/usr/bin/env node

/**
 * Interactive release script.
 * Triggers the GitHub Actions release workflow and auto-approves the deployment review.
 *
 * Usage: node scripts/release.mjs
 */

import { checkbox, confirm, select } from '@inquirer/prompts';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { $, chalk } from 'zx';

const REPO = 'jetstreamapp/jetstream';
const WORKFLOW = 'release.yml';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const RELEASE_NOTES_DIR = path.join(ROOT, 'apps/docs/release-notes');

const STATUS_COLORS = {
  completed: chalk.green,
  success: chalk.green,
  failure: chalk.red,
  cancelled: chalk.red,
  skipped: chalk.gray,
  in_progress: chalk.yellow,
  queued: chalk.cyan,
  waiting: chalk.cyan,
};

function colorStatus(value) {
  const fn = STATUS_COLORS[/** @type {keyof typeof STATUS_COLORS} */ (value)] ?? chalk.white;
  return fn(value);
}

function bumpVersion(version, bump) {
  const [major, minor, patch] = version
    .replace(/^v/, '')
    .split('.')
    .map((segment) => parseInt(segment, 10) || 0);
  if (bump === 'major') {
    return `${major + 1}.0.0`;
  }
  if (bump === 'minor') {
    return `${major}.${minor + 1}.0`;
  }
  return `${major}.${minor}.${patch + 1}`;
}

// Looks for a release-note file (e.g. `2026-06-22-v10.4.0.mdx`) for the given web version.
async function hasReleaseNoteFor(version) {
  try {
    const files = await readdir(RELEASE_NOTES_DIR);
    return files.some((file) => file.endsWith(`-v${version}.mdx`));
  } catch {
    return false;
  }
}

// ── Detect branch ──────────────────────────────────────────────────────────
// Hotfix branches release themselves (patch only). Everything else releases main.
const currentBranch = (await $`git rev-parse --abbrev-ref HEAD`.quiet()).stdout.trim();
const isHotfix = currentBranch.startsWith('hotfix/');
const releaseRef = isHotfix ? currentBranch : 'main';

// ── Header ─────────────────────────────────────────────────────────────────
console.log('\n' + chalk.bold.cyan('  Jetstream Release') + '\n');

// Hotfix releases ship straight from the branch (not main), so make the mode
// impossible to miss before the user starts toggling platforms.
if (isHotfix) {
  const lines = ['  🚨  HOTFIX RELEASE — patch only  ', `  releasing from ${currentBranch}  `];
  const width = Math.max(...lines.map((line) => line.length));
  const banner = chalk.bgRed.white.bold;
  const padded = (text) => banner(text + ' '.repeat(width - text.length));
  console.log('  ' + banner(' '.repeat(width)));
  for (const line of lines) {
    console.log('  ' + padded(line));
  }
  console.log('  ' + banner(' '.repeat(width)));
  console.log('');
}

// ── Fetch tags ─────────────────────────────────────────────────────────────
// Ensure compare links reference the actual latest release, not a stale local tag.
process.stdout.write(chalk.dim('  Fetching tags... '));
try {
  await $`git fetch origin --tags --prune --quiet`.quiet();
  console.log(chalk.green('done'));
} catch {
  console.log(chalk.yellow('skipped (offline?)'));
}

// ── Compare links ──────────────────────────────────────────────────────────
async function latestTag(pattern) {
  const result = await $`git tag --list ${pattern} --sort=-v:refname`.quiet();
  return (
    result.stdout
      .split('\n')
      .find((line) => line.trim().length > 0)
      ?.trim() ?? null
  );
}

const [webTag, extensionTag, desktopTag] = await Promise.all([latestTag('v[0-9]*'), latestTag('web-ext-v*'), latestTag('desktop-v*')]);

function compareUrl(tag) {
  return tag ? `https://github.com/${REPO}/compare/${tag}...${releaseRef}` : chalk.dim('(no prior tag found)');
}

console.log(chalk.dim('  Compare with latest release:'));
console.log(`  ${chalk.dim('web')}       ${chalk.underline.blue(compareUrl(webTag))}`);
console.log(`  ${chalk.dim('extension')} ${chalk.underline.blue(compareUrl(extensionTag))}`);
console.log(`  ${chalk.dim('desktop')}   ${chalk.underline.blue(compareUrl(desktopTag))}`);
console.log('');

// ── Prompt: bump type ──────────────────────────────────────────────────────
const bump = isHotfix
  ? 'patch'
  : await select({
      message: 'Version bump type',
      choices: [
        { value: 'patch', name: 'patch  – bug fixes' },
        { value: 'minor', name: 'minor  – new features' },
        { value: 'major', name: 'major  – breaking changes' },
      ],
      default: 'patch',
    });

// ── Prompt: platforms ─────────────────────────────────────────────────────
const platforms = await checkbox({
  message: 'Select platforms to release (space to toggle, enter to confirm)',
  choices: [
    { value: 'web', name: 'Web application' },
    { value: 'extension', name: 'Web extension' },
    { value: 'desktop', name: 'Desktop application' },
  ],
  validate(selected) {
    return selected.length > 0 ? true : 'Select at least one platform';
  },
});

const releaseWeb = platforms.includes('web');
const releaseExtension = platforms.includes('extension');
const releaseDesktop = platforms.includes('desktop');

// ── Confirm ────────────────────────────────────────────────────────────────
console.log('');
console.log(chalk.bold('  Release summary'));
console.log(chalk.dim('  ─────────────────────────'));
console.log(`  ${chalk.dim('branch')}    ${chalk.cyan(releaseRef)}${isHotfix ? '  ' + chalk.bgRed.white.bold(' HOTFIX ') : ''}`);
console.log(`  ${chalk.dim('bump')}      ${chalk.cyan(bump)}`);
console.log(`  ${chalk.dim('web')}       ${releaseWeb ? chalk.green('yes') : chalk.dim('no')}`);
console.log(`  ${chalk.dim('extension')} ${releaseExtension ? chalk.green('yes') : chalk.dim('no')}`);
console.log(`  ${chalk.dim('desktop')}   ${releaseDesktop ? chalk.green('yes') : chalk.dim('no')}`);
console.log('');

// ── Release-note reminder (non-blocking) ───────────────────────────────────
// Release notes live in apps/docs/release-notes and must land via a normal PR
// before the release is cut. Warn (but never block) if one is missing for the
// upcoming web version. See CONTRIBUTING.md → Releasing → Release notes.
if (releaseWeb) {
  const pkg = JSON.parse(await readFile(path.join(ROOT, 'package.json'), 'utf8'));
  const nextWebVersion = bumpVersion(pkg.version, bump);
  if (!(await hasReleaseNoteFor(nextWebVersion))) {
    console.log(chalk.yellow(`  ⚠ No release note found for v${nextWebVersion}.`));
    console.log(chalk.dim(`    Draft one with the Claude Code /release-notes command (or pnpm release-notes:context),`));
    console.log(chalk.dim(`    then merge the "docs: release notes v${nextWebVersion}" PR before releasing.`));
    const proceedWithoutNote = await confirm({ message: 'Continue the release without a release note?', default: false });
    if (!proceedWithoutNote) {
      console.log(chalk.yellow('\nAborted — draft the release note first.'));
      process.exit(0);
    }
    console.log('');
  }
}

const confirmMessage = isHotfix
  ? `Trigger ${chalk.bgRed.white.bold(' HOTFIX ')} release from ${chalk.cyan(currentBranch)}?`
  : 'Trigger release workflow?';
const ok = await confirm({ message: confirmMessage, default: !isHotfix });
if (!ok) {
  console.log(chalk.yellow('\nAborted.'));
  process.exit(0);
}

// ── Trigger workflow ───────────────────────────────────────────────────────
console.log('\n' + chalk.bold('Triggering workflow...'));

await $`gh workflow run ${WORKFLOW} \
  --repo ${REPO} \
  --ref ${releaseRef} \
  -f bump=${bump} \
  -f release_web=${String(releaseWeb)} \
  -f release_web_extension=${String(releaseExtension)} \
  -f release_desktop=${String(releaseDesktop)}`;

// Give GitHub a moment to register the run before we query for it
await new Promise((resolve) => setTimeout(resolve, 4000));

// ── Find the run ID ────────────────────────────────────────────────────────
process.stdout.write(chalk.dim('Fetching run ID... '));

const runListResult = await $`gh run list \
  --repo ${REPO} \
  --workflow=${WORKFLOW} \
  --limit 1 \
  --json databaseId \
  --jq '.[0].databaseId'`;

const runId = runListResult.stdout.trim();
if (!runId) {
  console.log(chalk.red('failed'));
  console.error(chalk.red('Could not determine run ID. Approve manually via the GitHub UI.'));
  process.exit(1);
}

console.log(chalk.green(runId));

// ── Wait for the deployment review to appear ───────────────────────────────
process.stdout.write(chalk.dim('Waiting for deployment review'));

let environmentId = null;
for (let attempt = 0; attempt < 20; attempt++) {
  await new Promise((resolve) => setTimeout(resolve, 3000));
  process.stdout.write(chalk.dim('.'));

  const pendingResult = await $`gh api repos/${REPO}/actions/runs/${runId}/pending_deployments`.quiet();

  const pending = JSON.parse(pendingResult.stdout);
  if (pending.length > 0) {
    environmentId = pending[0].environment.id;
    break;
  }
}

console.log('');

if (!environmentId) {
  console.error(chalk.red('\nNo pending deployment review found. Approve manually:'));
  console.log('  ' + chalk.cyan(`gh run review ${runId} --approve --repo ${REPO}`));
  process.exit(1);
}

// ── Approve ────────────────────────────────────────────────────────────────
process.stdout.write(chalk.dim(`Approving deployment... `));

await $`gh api repos/${REPO}/actions/runs/${runId}/pending_deployments \
  --method POST \
  -f state=approved \
  -f comment="Approved via release script" \
  -F environment_ids[]=${environmentId}`;

console.log(chalk.green('approved'));

// ── Print recovery commands early ──────────────────────────────────────────
// Print these before the status check / watch so they remain available in
// scrollback even if the user cancels (Ctrl+C) the watch step below.
const runUrl = `https://github.com/${REPO}/actions/runs/${runId}`;
console.log('');
console.log(chalk.dim('  To check again:'));
console.log('  ' + chalk.cyan(`gh run view ${runId} --repo ${REPO}`));
if (releaseExtension) {
  console.log('');
  console.log(chalk.dim('  Download web extension zips:'));
  console.log(
    '  ' +
      chalk.cyan(
        `rm -rf dist/web-extension-build && gh run download ${runId} --name web-extension-zips --dir dist/web-extension-build --repo ${REPO}`,
      ),
  );
}
console.log('');
console.log(`  ${chalk.dim('url')}  ${chalk.underline.blue(runUrl)}`);
console.log('');

// ── Initial status check ───────────────────────────────────────────────────
process.stdout.write(chalk.dim('Checking run status... '));
await new Promise((resolve) => setTimeout(resolve, 3000));

const statusResult = await $`gh run view ${runId} --repo ${REPO} --json status,conclusion,jobs \
    --jq '{status: .status, conclusion: .conclusion, jobs: [.jobs[] | {name: .name, status: .status, conclusion: .conclusion, databaseId: .databaseId}]}'`.quiet();

const { status, conclusion, jobs } = JSON.parse(statusResult.stdout);
console.log(colorStatus(conclusion ?? status));

console.log('');
console.log(chalk.bold('  Run status'));
console.log(chalk.dim('  ─────────────────────────'));
console.log(`  ${chalk.dim('status')}  ${colorStatus(status)}${conclusion ? chalk.dim(' → ') + colorStatus(conclusion) : ''}`);

let firstJobId = null;
if (jobs.length > 0) {
  console.log(`  ${chalk.dim('jobs')}`);
  for (const { name, status: jobStatus, conclusion: jobConclusion, databaseId } of jobs) {
    const jobState = jobConclusion ?? jobStatus;
    const jobId = databaseId ?? null;
    if (!firstJobId && jobId) {
      firstJobId = jobId;
    }
    console.log(`    ${chalk.dim('•')} ${name}  ${colorStatus(jobState)}`);
  }
}

// ── Fetch job logs ─────────────────────────────────────────────────────────
if (firstJobId) {
  console.log('');
  process.stdout.write(chalk.dim('Fetching job logs... '));
  try {
    const jobLogsResult = await $`gh run view --job=${firstJobId} --repo ${REPO}`.quiet();
    console.log(chalk.green('done'));
    console.log('');
    console.log(chalk.bold('  Job logs'));
    console.log(chalk.dim('  ─────────────────────────'));
    console.log(jobLogsResult.stdout);
  } catch {
    console.log(chalk.yellow('unavailable'));
  }
}

if (firstJobId) {
  console.log('');
  console.log(chalk.dim('  Job command:'));
  console.log('  ' + chalk.cyan(`gh run view --job=${firstJobId} --repo ${REPO}`));
  console.log('');
}

// ── Watch the run ─────────────────────────────────────────────────────────
console.log(chalk.bold('Watching workflow run...\n'));
try {
  await $({ stdio: 'inherit' })`gh run watch ${runId} --repo ${REPO} --exit-status`;
} catch (error) {
  // User cancelled (ctrl+c) or the run failed
  console.log(chalk.red('\nWorkflow run did not complete successfully.'));
  process.exit(1);
}

// ── Download web extension zips ───────────────────────────────────────────
if (releaseExtension) {
  console.log('');
  console.log(chalk.bold('Downloading web extension zips...'));
  try {
    await $`rm -rf dist/web-extension-build && gh run download ${runId} --name web-extension-zips --dir dist/web-extension-build --repo ${REPO}`;
    console.log(chalk.green('Downloaded to dist/web-extension-build'));
  } catch (error) {
    console.log(chalk.red('Failed to download web extension zips.'));
    console.log(
      '  ' +
        chalk.cyan(
          `rm -rf dist/web-extension-build && gh run download ${runId} --name web-extension-zips --dir dist/web-extension-build --repo ${REPO}`,
        ),
    );
  }
}
