#!/usr/bin/env node

/**
 * Interactive release script.
 * Triggers the GitHub Actions release workflow and auto-approves the deployment review.
 *
 * Usage: node scripts/release.mjs
 */

import { checkbox, confirm, select } from '@inquirer/prompts';
import { $, chalk } from 'zx';

const REPO = 'jetstreamapp/jetstream';
const WORKFLOW = 'release.yml';

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

// ── Header ─────────────────────────────────────────────────────────────────
console.log('\n' + chalk.bold.cyan('  Jetstream Release') + '\n');

// ── Prompt: bump type ──────────────────────────────────────────────────────
const bump = await select({
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
console.log(`  ${chalk.dim('bump')}      ${chalk.cyan(bump)}`);
console.log(`  ${chalk.dim('web')}       ${releaseWeb ? chalk.green('yes') : chalk.dim('no')}`);
console.log(`  ${chalk.dim('extension')} ${releaseExtension ? chalk.green('yes') : chalk.dim('no')}`);
console.log(`  ${chalk.dim('desktop')}   ${releaseDesktop ? chalk.green('yes') : chalk.dim('no')}`);
console.log('');

const ok = await confirm({ message: 'Trigger release workflow?', default: true });
if (!ok) {
  console.log(chalk.yellow('\nAborted.'));
  process.exit(0);
}

// ── Trigger workflow ───────────────────────────────────────────────────────
console.log('\n' + chalk.bold('Triggering workflow...'));

await $`gh workflow run ${WORKFLOW} \
  --repo ${REPO} \
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

const runUrl = `https://github.com/${REPO}/actions/runs/${runId}`;
console.log('');
console.log(chalk.dim('  To check again:'));
console.log('  ' + chalk.cyan(`gh run view ${runId} --repo ${REPO}`));
if (firstJobId) {
  console.log('  ' + chalk.cyan(`gh run view --job=${firstJobId} --repo ${REPO}`));
}
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
