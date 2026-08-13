#!/usr/bin/env node

/**
 * Download everything needed to diagnose a failed GitHub Actions run and unpack it into a folder
 * that is readable without a browser.
 *
 * This script does NOT call any AI — it only gathers evidence. Run it yourself when CI goes red,
 * or let the Claude Code `/fix-ci` slash command run it and work from what it produces.
 *
 * For every failed job it writes the full cleaned log plus a distilled excerpt containing the part
 * that explains the failure. When the run produced a Playwright HTML report it also unpacks that
 * report's embedded data and writes one folder per failed test: the error, the page snapshot taken
 * at failure, screenshots, browser console errors, failed HTTP requests, and the trace.
 *
 * Output lands in `tmp/ci-failures/<pr-or-branch>-<run-number>/`, starting with `summary.md`.
 *
 * Usage:
 *   pnpm ci:failures                       # latest failing run on the current branch
 *   pnpm ci:failures 1870                  # latest failing run for PR #1870
 *   pnpm ci:failures --run 31495580131     # a specific run id
 *   pnpm ci:failures <github url>          # PR url, run url, or job url (pasted from the browser)
 *   pnpm ci:failures --branch feat/thing --open
 *
 * Options:
 *   --run <id>        target a specific workflow run, by the id from its URL (not the "CI #123" number)
 *   --branch <name>   target a branch instead of the current one
 *   --repo <o/r>      target a different repository (default: this checkout's remote)
 *   --workflow <name> only consider runs of this workflow (e.g. "CI")
 *   --latest          use the most recent run even if it passed (default: newest failing run)
 *   --force           re-download over an existing bundle
 *   --no-report       skip the ~45MB HTML report and read the small JSON summary instead:
 *                     every failing test with its error, but no screenshots, page snapshot or trace
 *   --no-artifacts    skip artifact downloads entirely (job logs only)
 *   --no-traces       skip trace extraction (no console/network evidence)
 *   --open            open the Playwright HTML report when done
 *   --out <dir>       write the bundle somewhere other than tmp/ci-failures/
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import minimist from 'minimist';
import { distillJobLog, reproCommandFor } from './lib/ci-log-distiller.mjs';
import { extractFailuresFromJsonSummary, extractPlaywrightFailures, playwrightReproCommand } from './lib/playwright-report.mjs';

const require = createRequire(import.meta.url);
const JSZip = require('jszip');

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_ROOT = path.join(ROOT, 'tmp', 'ci-failures');
const PLAYWRIGHT_ARTIFACT = 'playwright-report';
const PLAYWRIGHT_SUMMARY_ARTIFACT = 'playwright-summary';
const RUNS_TO_SCAN = 15;
const FAILED_CONCLUSIONS = new Set(['failure', 'timed_out', 'cancelled', 'startup_failure']);

// Everything below runs at the top level, so a thrown error would otherwise surface as an unhandled
// rejection with a stack trace through this script's internals — noise that buries the actual problem.
process.on('uncaughtException', reportFatalError);
process.on('unhandledRejection', reportFatalError);

const options = parseArgs(process.argv.slice(2));
const repo = options.repo ?? currentRepoSlug();

const run = await resolveRun();
const jobs = await fetchJobs(run.id);
const failedJobs = jobs.filter(({ conclusion }) => FAILED_CONCLUSIONS.has(conclusion));

if (!failedJobs.length) {
  console.log(`\n${run.workflowName} #${run.runNumber} (${run.conclusion ?? run.status}) has no failed jobs — nothing to download.`);
  console.log(`  ${run.htmlUrl}\n`);
  process.exit(0);
}

const bundleDir = options.out ?? path.join(OUTPUT_ROOT, bundleName());
await prepareBundleDir();

console.log(`\n${run.workflowName} #${run.runNumber} — ${failedJobs.length} failed job(s) on ${run.headBranch}`);
console.log(`  ${run.htmlUrl}`);

const jobReports = await collectJobLogs();
const playwright = options.artifacts ? await collectPlaywrightReport() : null;

const summary = buildSummary(jobReports, playwright);
await writeFile(path.join(bundleDir, 'summary.md'), summary.markdown);
await writeFile(path.join(bundleDir, 'summary.json'), `${JSON.stringify(summary.json, null, 2)}\n`);

printConsoleSummary(jobReports, playwright);

if (options.open && playwright?.reportDir) {
  execFileSync('pnpm', ['exec', 'playwright', 'show-report', playwright.reportDir], { cwd: ROOT, stdio: 'inherit' });
}

// ---------------------------------------------------------------------------
// arguments and run resolution
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const parsed = minimist(argv, {
    boolean: ['artifacts', 'report', 'traces', 'open', 'force', 'latest', 'help'],
    string: ['run', 'branch', 'repo', 'workflow', 'out'],
    alias: { h: 'help', 'run-id': 'run' },
    default: { artifacts: true, report: true, traces: true },
  });

  if (parsed.help) {
    printHelpAndExit();
  }

  parsed.runId = parsed.run || undefined;
  parsed.out = parsed.out ? path.resolve(parsed.out) : undefined;
  parsed._.forEach((value) => applyPositional(parsed, String(value)));

  return parsed;
}

/** A bare number is a PR; a URL can carry a run id, a PR number, or both. */
function applyPositional(parsed, value) {
  if (/^\d+$/.test(value)) {
    parsed.prNumber = Number(value);
    return;
  }

  const runMatch = value.match(/actions\/runs\/(\d+)/);
  const prFromQuery = value.match(/[?&]pr=(\d+)/);
  const pullMatch = value.match(/\/pull\/(\d+)/);

  if (runMatch) {
    parsed.runId = runMatch[1];
  }
  if (prFromQuery || pullMatch) {
    parsed.prNumber = Number((prFromQuery ?? pullMatch)[1]);
  }
  if (!runMatch && !prFromQuery && !pullMatch) {
    throw new Error(`Unrecognized argument: ${value} (expected a PR number, a GitHub URL, or a flag)`);
  }
}

function printHelpAndExit() {
  const source = readFileSync(fileURLToPath(import.meta.url), 'utf8');
  const doc = source.slice(source.indexOf('/**'), source.indexOf('*/'));
  console.log(doc.replace(/^\/\*\*\n/, '').replace(/^ \* ?/gm, ''));
  process.exit(0);
}

function reportFatalError(error) {
  console.error(`\n${error?.message || error}\n`);
  process.exit(1);
}

function gh(args, { json = true, buffer = false } = {}) {
  let result;
  try {
    result = execFileSync('gh', args, {
      cwd: ROOT,
      maxBuffer: 512 * 1024 * 1024,
      encoding: buffer ? 'buffer' : 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (error) {
    const detail = String(error.stderr || error.stdout || error.message).trim();
    throw new Error(`\`gh ${args.join(' ')}\` failed:\n  ${detail.split('\n').join('\n  ')}`);
  }
  if (buffer) {
    return result;
  }
  return json ? JSON.parse(result) : result.trim();
}

function currentRepoSlug() {
  return gh(['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner'], { json: false });
}

function currentBranch() {
  return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
}

function normalizeRun(raw) {
  return {
    id: raw.id,
    runNumber: raw.run_number,
    attempt: raw.run_attempt,
    workflowName: raw.name,
    headBranch: raw.head_branch,
    headSha: raw.head_sha,
    status: raw.status,
    conclusion: raw.conclusion,
    createdAt: raw.created_at,
    htmlUrl: raw.html_url,
    displayTitle: raw.display_title,
    prNumber: options.prNumber ?? raw.pull_requests?.[0]?.number ?? null,
  };
}

async function resolveRun() {
  if (options.runId) {
    try {
      return normalizeRun(gh(['api', `repos/${repo}/actions/runs/${options.runId}`]));
    } catch {
      throw new Error(
        `No workflow run with id ${options.runId} in ${repo}.\n` +
          `--run takes the id from the run URL (…/actions/runs/<id>), not the "CI #123" number shown in the summary.\n` +
          `To target a run without its id, pass a PR number, a run URL, or --branch <name>.`,
      );
    }
  }

  // A PR is resolved by its head commit so that forks and renamed branches still work, and also by
  // its branch so that a push made after CI failed does not hide the failure behind a fresh run.
  const queries = [];
  if (options.prNumber) {
    const pr = gh(['pr', 'view', String(options.prNumber), '--repo', repo, '--json', 'headRefName,headRefOid']);
    queries.push({ head_sha: pr.headRefOid }, { branch: pr.headRefName });
  } else {
    queries.push({ branch: options.branch ?? currentBranch() });
  }

  const byId = new Map();
  for (const filter of queries) {
    const query = new URLSearchParams({ per_page: String(RUNS_TO_SCAN), ...filter });
    const { workflow_runs: runs = [] } = gh(['api', `repos/${repo}/actions/runs?${query}`]);
    runs.forEach((raw) => byId.set(raw.id, raw));
  }

  const candidates = [...byId.values()]
    .filter(({ name }) => !options.workflow || name === options.workflow)
    .sort((left, right) => new Date(right.created_at) - new Date(left.created_at));

  if (!candidates.length) {
    throw new Error(`No workflow runs found for ${options.prNumber ? `PR #${options.prNumber}` : (options.branch ?? currentBranch())}`);
  }

  const failed = candidates.find(({ conclusion }) => FAILED_CONCLUSIONS.has(conclusion));
  const selected = options.latest ? candidates[0] : (failed ?? candidates[0]);

  if (selected.id !== candidates[0].id) {
    console.log(`Note: the newest run ${describeRunOutcome(candidates[0])}; using the newest failing run instead (--latest overrides).`);
  }
  if (selected.status !== 'completed') {
    console.log(`Note: this run is still ${selected.status} — jobs that have not finished cannot report a failure yet.`);
  }

  return normalizeRun(selected);
}

function describeRunOutcome({ conclusion, status }) {
  if (!conclusion) {
    return `is still ${String(status).replace(/_/g, ' ')}`;
  }
  return conclusion === 'success' ? 'succeeded' : `finished as ${conclusion.replace(/_/g, ' ')}`;
}

async function fetchJobs(runId) {
  const { jobs = [] } = gh(['api', `repos/${repo}/actions/runs/${runId}/jobs?per_page=100`]);
  return jobs.map((job) => ({
    id: job.id,
    name: job.name,
    conclusion: job.conclusion,
    htmlUrl: job.html_url,
    failedSteps: (job.steps ?? []).filter(({ conclusion }) => FAILED_CONCLUSIONS.has(conclusion)).map(({ name }) => name),
  }));
}

function bundleName() {
  const label = run.prNumber ? `pr-${run.prNumber}` : (run.headBranch ?? 'unknown').replace(/[^\w.-]+/g, '-');
  return `${label}-${run.runNumber}`;
}

async function prepareBundleDir() {
  if (existsSync(bundleDir)) {
    if (!options.force) {
      console.log(`\nBundle already exists at ${relative(bundleDir)} — refreshing it (pass --force to start clean).`);
    } else {
      await rm(bundleDir, { recursive: true, force: true });
    }
  }
  await mkdir(bundleDir, { recursive: true });
}

/** Repo-relative path when the target is inside the repo, absolute when `--out` points elsewhere. */
function relative(target) {
  const relativePath = path.relative(ROOT, target);
  if (!relativePath) {
    return '.';
  }
  return relativePath.startsWith('..') ? target : relativePath;
}

function slug(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function truncate(value = '', max) {
  return value.length > max ? `${value.slice(0, max)}\n… truncated, see the linked file …` : value;
}

function firstLine(value = '') {
  return value.split('\n')[0].trim() || '(no message)';
}

// ---------------------------------------------------------------------------
// logs
// ---------------------------------------------------------------------------

/**
 * The whole run's logs come down as one small zip (a few hundred KB), which is far cheaper than
 * `gh run view --log` per job. Entries are named `<index>_<job name>.txt`.
 */
async function collectJobLogs() {
  const logsDir = path.join(bundleDir, 'logs');
  await mkdir(logsDir, { recursive: true });

  let archive;
  try {
    archive = await JSZip.loadAsync(gh(['api', `repos/${repo}/actions/runs/${run.id}/logs`], { buffer: true }));
  } catch (error) {
    console.warn(`  ! Could not download run logs (${error.message.split('\n')[0]}) — they may have expired.`);
    return failedJobs.map((job) => ({ job, unavailable: true }));
  }

  const entries = Object.keys(archive.files).filter((name) => /^\d+_.+\.txt$/.test(name));

  return Promise.all(
    failedJobs.map(async (job) => {
      const entry =
        entries.find((name) => name.replace(/^\d+_/, '').replace(/\.txt$/, '') === job.name) ??
        entries.find((name) => slug(name.replace(/^\d+_/, '').replace(/\.txt$/, '')) === slug(job.name));

      if (!entry) {
        return { job, unavailable: true };
      }

      const distilled = distillJobLog(await archive.file(entry).async('string'));
      const fileBase = slug(job.name);
      await writeFile(path.join(logsDir, `${fileBase}.log`), distilled.cleanedLog);
      await writeFile(path.join(logsDir, `${fileBase}.failure.txt`), `${distilled.excerpt}\n`);

      return {
        job,
        framework: distilled.framework,
        failingCommand: distilled.failingCommand,
        failedNxTasks: distilled.failedNxTasks,
        likelyGateJob: distilled.likelyGateJob,
        excerpt: distilled.excerpt,
        fullLog: path.posix.join('logs', `${fileBase}.log`),
        failureLog: path.posix.join('logs', `${fileBase}.failure.txt`),
        repro: reproCommandFor(distilled.framework, distilled.failedNxTasks),
      };
    }),
  );
}

// ---------------------------------------------------------------------------
// playwright artifacts
// ---------------------------------------------------------------------------

function downloadArtifact(name, targetDir) {
  execFileSync('gh', ['run', 'download', String(run.id), '--repo', repo, '--name', name, '--dir', targetDir], {
    cwd: ROOT,
    stdio: 'inherit',
  });
}

/**
 * Prefer the full HTML report, which carries the screenshots, page snapshots and traces. Fall back
 * to the small JSON summary when the report is unwanted (`--no-report`) or gone: it still yields
 * every failing test with its error and code frame, for a download measured in KB rather than tens
 * of MB.
 */
async function collectPlaywrightReport() {
  const { artifacts = [] } = gh(['api', `repos/${repo}/actions/runs/${run.id}/artifacts?per_page=100`]);
  const byName = (wanted) => artifacts.find(({ name, expired }) => name === wanted && !expired);

  const reportArtifact = byName(PLAYWRIGHT_ARTIFACT);
  const summary = byName(PLAYWRIGHT_SUMMARY_ARTIFACT);

  // `--no-report` avoids the large *download*; a report already sitting in the bundle is free, and
  // discarding it would silently downgrade a bundle that already had screenshots and traces.
  const reportDir = path.join(bundleDir, 'playwright', 'report');
  const reportOnDisk = existsSync(path.join(reportDir, 'index.html'));
  const useReport = reportOnDisk || (options.report && Boolean(reportArtifact));

  if (!useReport && !summary) {
    if (!options.report && reportArtifact) {
      console.log(`  ! --no-report was passed and this run has no ${PLAYWRIGHT_SUMMARY_ARTIFACT} artifact — using job logs only.`);
    } else if (artifacts.some(({ name, expired }) => name === PLAYWRIGHT_ARTIFACT && expired)) {
      console.log('  ! The Playwright artifacts for this run have expired — using job logs only.');
    }
    return null;
  }

  const failuresDir = path.join(bundleDir, 'playwright', 'failures');
  await mkdir(failuresDir, { recursive: true });

  if (useReport) {
    if (!reportOnDisk) {
      console.log(`  · downloading ${PLAYWRIGHT_ARTIFACT} (${(reportArtifact.size_in_bytes / 1024 / 1024).toFixed(1)} MB)…`);
      await mkdir(reportDir, { recursive: true });
      downloadArtifact(PLAYWRIGHT_ARTIFACT, reportDir);
    }
    try {
      return { ...(await extractPlaywrightFailures(reportDir, failuresDir, { includeTraces: options.traces })), reportDir };
    } catch (error) {
      console.warn(`  ! Could not read the Playwright report: ${error.message} — trying the JSON summary.`);
    }
  }

  if (!summary) {
    return { failures: [] };
  }

  const summaryDir = path.join(bundleDir, 'playwright');
  const summaryPath = path.join(summaryDir, 'playwright-summary.json');
  if (!existsSync(summaryPath)) {
    downloadArtifact(PLAYWRIGHT_SUMMARY_ARTIFACT, summaryDir);
  }

  try {
    return await extractFailuresFromJsonSummary(summaryPath, failuresDir);
  } catch (error) {
    console.warn(`  ! Could not read the Playwright JSON summary: ${error.message}`);
    return { failures: [] };
  }
}

// ---------------------------------------------------------------------------
// summary
// ---------------------------------------------------------------------------

/** Whether the working tree is actually on the commit that failed, which changes how to read all of this. */
function localCommitState() {
  try {
    const head = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
    if (head === run.headSha) {
      return 'HEAD is the commit that failed';
    }
    try {
      execFileSync('git', ['merge-base', '--is-ancestor', run.headSha, 'HEAD'], { cwd: ROOT, stdio: 'ignore' });
      return `HEAD (${head.slice(0, 8)}) is ahead of the failing commit (${run.headSha.slice(0, 8)}) — local fixes may already cover this`;
    } catch {
      return `HEAD (${head.slice(0, 8)}) does not contain the failing commit (${run.headSha.slice(0, 8)}) — check out the run's branch before reproducing`;
    }
  } catch {
    return 'unknown (not a git checkout?)';
  }
}

function buildSummary(jobReports, playwright) {
  const lines = [];
  const push = (...values) => lines.push(...values);

  push(`# CI failure — ${run.workflowName} #${run.runNumber}`, '');
  push(`- Run: ${run.htmlUrl} (attempt ${run.attempt}, ${run.conclusion ?? run.status})`);
  if (run.prNumber) {
    push(`- PR: #${run.prNumber} — ${run.displayTitle}`);
  }
  push(`- Branch: \`${run.headBranch}\` @ \`${run.headSha?.slice(0, 8)}\``);
  push(`- Local: ${localCommitState()}`);
  push(`- Failed jobs: ${failedJobs.map(({ name }) => name).join(', ')}`);
  push('');

  if (playwright?.stats) {
    const { total, expected, unexpected, flaky, skipped } = playwright.stats;
    push(`Playwright: ${unexpected} failed, ${flaky} flaky, ${expected} passed, ${skipped} skipped (of ${total})`, '');
  }

  const failures = playwright?.failures ?? [];

  push('## Failed jobs', '');
  for (const report of jobReports) {
    const { job } = report;
    push(`### ${job.name}`);
    push(`- Step: ${job.failedSteps.join(', ') || '(unknown)'} · ${job.htmlUrl}`);
    if (report.unavailable) {
      push('- Log unavailable (expired or not in the run archive)', '');
      continue;
    }
    push(`- Detected: ${report.framework}${report.failedNxTasks.length ? ` · failed Nx tasks: ${report.failedNxTasks.join(', ')}` : ''}`);
    push(`- Ran: \`${report.failingCommand.split('\n')[0].slice(0, 160)}\``);
    push(`- Distilled excerpt: \`${report.failureLog}\` · full log: \`${report.fullLog}\``);
    if (report.likelyGateJob) {
      push("- This job produced almost no output — it is a gate reporting another job's failure, not a failure of its own.");
    }
    if (report.repro) {
      push(`- Repro: \`${report.repro}\``);
    }
    // When the structured Playwright section below covers the same failure, the log excerpt only
    // needs to establish context — it otherwise repeats every error once per retry.
    const excerptBudget = report.framework === 'playwright' && failures.length ? 1200 : 2500;
    push('', '```', truncate(report.excerpt, excerptBudget), '```', '');
  }

  if (failures.length) {
    push('## Failed Playwright tests', '');
    if (playwright.textOnly) {
      push(
        'Read from the small `playwright-summary` artifact: error text and code frames only. For the',
        'screenshots, the page snapshot and the trace, re-run without `--no-report` while the',
        '`playwright-report` artifact still exists (it is kept for 14 days).',
        '',
      );
    }
    failures.forEach((failure, index) => {
      push(`### ${index + 1}. ${failure.title}`);
      push(
        `- Outcome: ${failure.outcome === 'flaky' ? 'FLAKY (passed on retry)' : 'failed'} after ${failure.attempts} attempt(s), project ${failure.projectName}`,
      );
      push(
        `- Spec: \`${failure.specFile}:${failure.specLine}\`${failure.throwSite ? ` · threw at \`${failure.throwSite.file}:${failure.throwSite.line}\`` : ''}`,
      );
      push(`- Error: ${firstLine(failure.errors[0]?.message)}`);
      push(`- Evidence: \`playwright/failures/${failure.dir}/\` → ${failure.evidence.join(', ')}`);
      if (failure.traceSignals) {
        const { consoleErrors, networkFailures, requestCount } = failure.traceSignals;
        push(
          `- Trace: ${consoleErrors} console error(s), ${networkFailures} failed request(s) of ${requestCount} — ${consoleErrors + networkFailures === 0 ? 'the app was not erroring, so look at the locator/UI state' : 'see the files above'}`,
        );
      }
      if (failure.tracePath) {
        push(`- Trace viewer: \`pnpm exec playwright show-trace ${relative(failure.tracePath)}\``);
      }
      push('- Repro:', '', '```bash', playwrightReproCommand(failure), '```', '');
    });
  } else if (playwright?.reportDir) {
    push('## Playwright', '', 'The report contained no failed tests — the job failed before or after the suite.', '');
  }

  if (playwright?.topLevelErrors?.length) {
    push('## Playwright run-level notes', '', '```', playwright.topLevelErrors.join('\n\n'), '```', '');
  }

  push('## Files', '');
  push(`- \`${relative(bundleDir)}/summary.json\` — the same data, machine readable`);
  push(`- \`${relative(bundleDir)}/logs/*.failure.txt\` — distilled failure excerpt per job`);
  push(`- \`${relative(bundleDir)}/logs/*.log\` — full cleaned job logs`);
  if (playwright?.reportDir) {
    push(`- \`${relative(playwright.reportDir)}\` — HTML report: \`pnpm exec playwright show-report ${relative(playwright.reportDir)}\``);
    push('- `playwright/failures/<n>-<test>/page-snapshot.md` — accessibility snapshot of the page at the moment of failure');
    push('- `playwright/failures/<n>-<test>/screenshot-*.png` — what the page looked like when it failed');
  }
  push('');

  return {
    markdown: lines.join('\n'),
    json: {
      repo,
      run: { ...run, url: run.htmlUrl },
      generatedAt: new Date().toISOString(),
      jobs: jobReports.map(({ job, excerpt, ...rest }) => ({ name: job.name, failedSteps: job.failedSteps, url: job.htmlUrl, ...rest })),
      playwright: playwright ? { stats: playwright.stats ?? null, expired: Boolean(playwright.expired), failures } : null,
    },
  };
}

function printConsoleSummary(jobReports, playwright) {
  console.log('');
  for (const report of jobReports) {
    const detail = report.unavailable
      ? 'log unavailable'
      : `${report.framework}${report.failedNxTasks.length ? ` · ${report.failedNxTasks.join(', ')}` : ''}`;
    console.log(`  ✗ ${report.job.name} — ${report.job.failedSteps.join(', ') || 'unknown step'} (${detail})`);
  }
  for (const failure of playwright?.failures ?? []) {
    console.log(`  ✗ ${failure.title}`);
    console.log(`      ${firstLine(failure.errors[0]?.message)}`);
    console.log(`      ${relative(path.join(bundleDir, 'playwright', 'failures', failure.dir))}/`);
  }
  console.log(`\n  → ${relative(bundleDir)}/summary.md\n`);
}
