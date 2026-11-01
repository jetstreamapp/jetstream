#!/usr/bin/env node

/**
 * Interactive Salesforce managed package release script.
 * Triggers the `sfdx-release.yml` GitHub Actions workflow and auto-approves the
 * deployment review, then watches the run.
 *
 * Usage: node scripts/release-salesforce.mjs  (or `pnpm release:salesforce`)
 */

import { confirm, select } from '@inquirer/prompts';
import { $, chalk } from 'zx';

const REPO = 'jetstreamapp/jetstream';
const WORKFLOW = 'sfdx-release.yml';

// ── Header ─────────────────────────────────────────────────────────────────
console.log('\n' + chalk.bold.cyan('  Jetstream — Salesforce Managed Package Release') + '\n');

// ── Detect branch ──────────────────────────────────────────────────────────
const currentBranch = (await $`git rev-parse --abbrev-ref HEAD`.quiet()).stdout.trim();
const isHotfix = currentBranch.startsWith('hotfix/');
const releaseRef = isHotfix ? currentBranch : 'main';

// ── Fetch tags + compare link ──────────────────────────────────────────────
process.stdout.write(chalk.dim('  Fetching tags... '));
try {
  await $`git fetch origin --tags --prune --quiet`.quiet();
  console.log(chalk.green('done'));
} catch {
  console.log(chalk.yellow('skipped (offline?)'));
}

const latestTag = (
  (await $`git tag --list salesforce-v* --sort=-v:refname`.quiet()).stdout.split('\n').find((line) => line.trim().length > 0) ?? ''
).trim();

const compareUrl = latestTag ? `https://github.com/${REPO}/compare/${latestTag}...${releaseRef}` : chalk.dim('(no prior tag found)');
console.log(`  ${chalk.dim('compare')}  ${chalk.underline.blue(compareUrl)}`);
console.log('');

// ── Prompts ────────────────────────────────────────────────────────────────
const bump = await select({
  message: 'Version bump type',
  choices: [
    { value: 'patch', name: 'patch  – bug fixes' },
    { value: 'minor', name: 'minor  – new features' },
    { value: 'major', name: 'major  – breaking changes' },
  ],
  default: 'patch',
});

const promote = await confirm({
  message: 'Promote to released (installable in production orgs)? No = beta only (scratch/sandbox)',
  default: true,
});

// The workflow runs the remote tip of the ref, so that is the commit the operator is approving. It is
// captured now and the dispatched run must match it before the deployment is approved.
let expectedHeadSha;
try {
  expectedHeadSha = (await $`git rev-parse --verify ${`origin/${releaseRef}^{commit}`}`.quiet()).stdout.trim();
} catch {
  console.error(chalk.red(`\norigin/${releaseRef} was not found. Push the branch first.`));
  process.exit(1);
}

// ── Confirm ────────────────────────────────────────────────────────────────
console.log('');
console.log(chalk.bold('  Release summary'));
console.log(chalk.dim('  ─────────────────────────'));
console.log(`  ${chalk.dim('branch')}   ${chalk.cyan(releaseRef)}${isHotfix ? chalk.dim(' (hotfix)') : ''}`);
console.log(`  ${chalk.dim('commit')}   ${chalk.cyan(expectedHeadSha.slice(0, 12))}`);
console.log(`  ${chalk.dim('bump')}     ${chalk.cyan(bump)}`);
console.log(`  ${chalk.dim('promote')}  ${promote ? chalk.green('yes (released)') : chalk.yellow('no (beta)')}`);
console.log('');

const ok = await confirm({ message: 'Trigger Salesforce release workflow?', default: true });
if (!ok) {
  console.log(chalk.yellow('\nAborted.'));
  process.exit(0);
}

// ── Trigger workflow ───────────────────────────────────────────────────────
async function listDispatchedRunIds() {
  const runs = JSON.parse(
    (
      await $`gh run list \
  --repo ${REPO} \
  --workflow=${WORKFLOW} \
  --branch ${releaseRef} \
  --event workflow_dispatch \
  --limit 20 \
  --json databaseId`.quiet()
    ).stdout,
  );
  return runs.map(({ databaseId }) => String(databaseId));
}

const currentUserLogin = (await $`gh api user --jq .login`.quiet()).stdout.trim();
// Runs that already exist are never candidates, so a run left waiting for review by an earlier
// attempt (or dispatched by someone else) cannot be mistaken for this one
const preexistingRunIds = new Set(await listDispatchedRunIds());

console.log('\n' + chalk.bold('Triggering workflow...'));

await $`gh workflow run ${WORKFLOW} \
  --repo ${REPO} \
  --ref ${releaseRef} \
  -f bump=${bump} \
  -f promote=${String(promote)}`;

// ── Find the run ID ────────────────────────────────────────────────────────
process.stdout.write(chalk.dim('Fetching run ID'));

// GitHub registers a dispatched run asynchronously, so poll until a new run shows up
let newRunIds = [];
for (let attempt = 0; attempt < 20 && newRunIds.length === 0; attempt++) {
  await new Promise((resolve) => setTimeout(resolve, 3000));
  process.stdout.write(chalk.dim('.'));
  newRunIds = (await listDispatchedRunIds()).filter((runId) => !preexistingRunIds.has(runId));
}

if (newRunIds.length !== 1) {
  console.log(chalk.red(' failed'));
  console.error(
    chalk.red(
      newRunIds.length === 0
        ? 'The dispatched run did not appear. Approve manually via the GitHub UI.'
        : `Found ${newRunIds.length} new runs (${newRunIds.join(', ')}), so the one this script dispatched is ambiguous. Approve manually via the GitHub UI.`,
    ),
  );
  process.exit(1);
}

const [runId] = newRunIds;
console.log(' ' + chalk.green(runId));

// Only approve the run this invocation dispatched, for the commit shown in the summary
const dispatchedRun = JSON.parse((await $`gh api repos/${REPO}/actions/runs/${runId}`.quiet()).stdout);
const runMismatches = [
  dispatchedRun.event !== 'workflow_dispatch' && `event is ${dispatchedRun.event}`,
  dispatchedRun.actor?.login !== currentUserLogin && `dispatched by ${dispatchedRun.actor?.login}`,
  dispatchedRun.head_sha !== expectedHeadSha &&
    `commit is ${dispatchedRun.head_sha?.slice(0, 12)}, expected ${expectedHeadSha.slice(0, 12)}`,
].filter(Boolean);

if (runMismatches.length > 0) {
  console.error(chalk.red(`\nRun ${runId} does not match this release (${runMismatches.join('; ')}). Not approving it.`));
  console.log('  ' + chalk.cyan(`https://github.com/${REPO}/actions/runs/${runId}`));
  process.exit(1);
}

// ── Wait for the deployment review to appear ───────────────────────────────
process.stdout.write(chalk.dim('Waiting for deployment review'));

let environmentId = null;
for (let attempt = 0; attempt < 20; attempt++) {
  await new Promise((resolve) => setTimeout(resolve, 3000));
  process.stdout.write(chalk.dim('.'));

  const pending = JSON.parse((await $`gh api repos/${REPO}/actions/runs/${runId}/pending_deployments`.quiet()).stdout);
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
  -f comment="Approved via Salesforce release script" \
  -F environment_ids[]=${environmentId}`;

console.log(chalk.green('approved'));

// ── Print recovery info early (survives ctrl+c on the watch below) ─────────
const runUrl = `https://github.com/${REPO}/actions/runs/${runId}`;
console.log('');
console.log(chalk.dim('  To check again:'));
console.log('  ' + chalk.cyan(`gh run view ${runId} --repo ${REPO}`));
console.log('');
console.log(`  ${chalk.dim('url')}  ${chalk.underline.blue(runUrl)}`);
console.log('');

// ── Watch the run ─────────────────────────────────────────────────────────
console.log(chalk.bold('Watching workflow run...\n'));
try {
  await $({ stdio: 'inherit' })`gh run watch ${runId} --repo ${REPO} --exit-status`;
} catch {
  console.log(chalk.red('\nWorkflow run did not complete successfully.'));
  process.exit(1);
}

// ── Done ───────────────────────────────────────────────────────────────────
console.log('');
console.log(chalk.green.bold('  Salesforce package released.'));
console.log(chalk.dim('  The install URL and package version id are in the run summary:'));
console.log(`  ${chalk.underline.blue(runUrl)}`);
console.log('');
