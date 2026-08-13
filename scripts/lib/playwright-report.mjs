/**
 * Reads a downloaded Playwright HTML report and turns the failures into plain files.
 *
 * The HTML report is built for a browser, not for reading: `index.html` is a ~1MB React bundle
 * with the entire report zipped and base64'd into a `<template>` tag, and every attachment is a
 * content-addressed blob under `data/`. Nothing in there can be grepped or opened directly.
 *
 * This module unpacks that template back into JSON, pulls out the tests that did not pass, and
 * writes each one into its own folder with the error, the page snapshot taken at failure, the
 * screenshots, and — dug out of the trace — the browser console errors and failed HTTP requests.
 * Those last two usually answer "why did the locator never appear" faster than anything else.
 */

import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { stripAnsi } from './ci-log-distiller.mjs';

const require = createRequire(import.meta.url);
const JSZip = require('jszip');

const EMBEDDED_REPORT = /<template id=["']playwrightReportBase64["']>data:application\/zip;base64,([\s\S]*?)<\/template>/;
const MAX_CONSOLE_ENTRIES = 200;
const MAX_NETWORK_ENTRIES = 200;
const DEFAULT_SPEC_PREFIX = 'apps/jetstream-e2e/src';

/** Filesystem-safe, still-readable folder name for a test title. */
function slugify(value) {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'test'
  );
}

/** Decode the report data that the HTML reporter embeds in `index.html`. */
async function loadEmbeddedReport(reportDir) {
  const html = await readFile(path.join(reportDir, 'index.html'), 'utf8');
  const match = html.match(EMBEDDED_REPORT);
  if (!match) {
    throw new Error(`No embedded report found in ${reportDir}/index.html — the report format may have changed`);
  }
  const zip = await JSZip.loadAsync(Buffer.from(match[1], 'base64'));
  const report = JSON.parse(await zip.file('report.json').async('string'));

  const testFiles = [];
  for (const name of Object.keys(zip.files)) {
    if (name === 'report.json' || !name.endsWith('.json')) {
      continue;
    }
    testFiles.push(JSON.parse(await zip.file(name).async('string')));
  }

  return { report, testFiles };
}

/**
 * Console errors and failed requests from a trace zip. Best effort — the trace format is internal
 * to Playwright, so a shape change here degrades the bundle instead of failing the run.
 */
async function readTraceSignals(traceZipPath) {
  const consoleMessages = [];
  const networkFailures = [];
  let requestCount = 0;

  try {
    const zip = await JSZip.loadAsync(await readFile(traceZipPath));

    for (const name of Object.keys(zip.files)) {
      if (!name.endsWith('.trace') && !name.endsWith('.network')) {
        continue;
      }
      const contents = await zip.file(name).async('string');
      for (const line of contents.split('\n')) {
        if (!line.trim()) {
          continue;
        }
        let event;
        try {
          event = JSON.parse(line);
        } catch {
          continue;
        }

        // Console logs and page errors share one budget: a page that throws in a loop should not
        // be able to fill the bundle with thousands of near-identical entries.
        const withinConsoleBudget = consoleMessages.length < MAX_CONSOLE_ENTRIES;

        if (event.type === 'console' && withinConsoleBudget) {
          consoleMessages.push({ level: event.messageType || 'log', text: stripAnsi(event.text || '') });
        } else if (event.type === 'event' && withinConsoleBudget && /error/i.test(event.method || '')) {
          consoleMessages.push({ level: 'pageerror', text: JSON.stringify(event.params || {}).slice(0, 2000) });
        } else if (event.type === 'resource-snapshot') {
          requestCount += 1;
          const { request, response } = event.snapshot || {};
          const status = response?.status ?? 0;
          if (request?.url && (status === 0 || status >= 400) && networkFailures.length < MAX_NETWORK_ENTRIES) {
            networkFailures.push({ method: request.method, url: request.url, status, statusText: response?.statusText });
          }
        }
      }
    }
  } catch {
    return { consoleMessages: [], networkFailures: [], requestCount: 0, unreadable: true };
  }

  return { consoleMessages, networkFailures, requestCount, unreadable: false };
}

/** The `file.spec.ts:line:col` the error was thrown at, which is usually not the test's own line. */
function findThrowSite(errorMessage) {
  const match = stripAnsi(errorMessage).match(/at (?:.*[/\\])?([\w.-]+\.(?:spec|test)\.ts):(\d+):(\d+)/);
  return match ? { file: match[1], line: Number(match[2]), column: Number(match[3]) } : null;
}

/**
 * Spec paths are reported relative to Playwright's rootDir, which is an absolute path on the
 * runner. Recover the repo-relative path so every reference in the bundle is clickable locally.
 */
function repoRelativeSpec(file, rootDir) {
  const match = /(?:^|\/)((?:apps|libs)\/.*)$/.exec(rootDir ?? '');
  return path.posix.join(match ? match[1] : DEFAULT_SPEC_PREFIX, file);
}

function collectFailures({ report, testFiles }) {
  const failures = [];

  for (const testFile of testFiles) {
    for (const test of testFile.tests || []) {
      if (test.outcome !== 'unexpected' && test.outcome !== 'flaky') {
        continue;
      }
      const attempts = test.results || [];
      const lastFailed = [...attempts].reverse().find(({ status }) => status !== 'passed') ?? attempts[attempts.length - 1];
      const errors = (lastFailed?.errors || []).map((error) => ({
        message: stripAnsi(error.message || ''),
        codeframe: stripAnsi(error.codeframe || ''),
      }));

      failures.push({
        title: [...(test.path || []), test.title].join(' › '),
        projectName: test.projectName,
        outcome: test.outcome,
        specFile: repoRelativeSpec(test.location?.file || testFile.fileName),
        specLine: test.location?.line,
        attempts: attempts.length,
        durationMs: test.duration,
        throwSite: findThrowSite(errors[0]?.message || ''),
        errors,
        attachments: lastFailed?.attachments || [],
        stdout: (lastFailed?.attachments || []).find(({ name }) => name === 'stdout')?.body,
        stderr: (lastFailed?.attachments || []).find(({ name }) => name === 'stderr')?.body,
      });
    }
  }

  return { stats: report.stats, topLevelErrors: (report.errors || []).map(stripAnsi), failures };
}

/**
 * The same failure records, read from the small `playwright-summary` JSON artifact instead of the
 * HTML report. Everything textual survives; the attachments do not, because the JSON reporter only
 * records where they were written on the runner.
 */
function collectFailuresFromJson(json) {
  const failures = [];
  const rootDir = json.config?.rootDir;

  const walk = (suite, titlePath) => {
    for (const spec of suite.specs || []) {
      for (const test of spec.tests || []) {
        if (test.status !== 'unexpected' && test.status !== 'flaky') {
          continue;
        }
        const attempts = test.results || [];
        const lastFailed = [...attempts].reverse().find(({ status }) => status !== 'passed') ?? attempts[attempts.length - 1];
        const { error, errorLocation } = lastFailed ?? {};

        failures.push({
          title: [...titlePath, spec.title].join(' › '),
          projectName: test.projectName,
          outcome: test.status,
          specFile: repoRelativeSpec(spec.file, rootDir),
          specLine: spec.line,
          attempts: attempts.length,
          throwSite: errorLocation ? { file: path.basename(errorLocation.file), line: errorLocation.line } : null,
          errors: [{ message: stripAnsi(error?.message || ''), codeframe: stripAnsi(error?.snippet || '') }],
          attachments: [],
        });
      }
    }
    for (const child of suite.suites || []) {
      walk(child, child.title ? [...titlePath, child.title] : titlePath);
    }
  };

  // The outermost suite is the spec file itself, whose title would just repeat the path.
  for (const fileSuite of json.suites || []) {
    walk(fileSuite, []);
  }

  const { expected = 0, unexpected = 0, flaky = 0, skipped = 0 } = json.stats ?? {};

  return {
    stats: { total: expected + unexpected + flaky + skipped, expected, unexpected, flaky, skipped },
    topLevelErrors: (json.errors || []).map(({ message }) => stripAnsi(message || '')),
    failures,
  };
}

/** Create a failed test's folder and write the one file every source can produce: the error. */
async function startFailureFolder(bundleDir, failure, index) {
  const folderName = `${index + 1}-${slugify(failure.title)}`;
  const failureDir = path.join(bundleDir, folderName);
  await mkdir(failureDir, { recursive: true });

  const errorText = failure.errors
    .map(({ message, codeframe }, errorIndex) => [`--- error ${errorIndex + 1} ---`, message, '', codeframe].join('\n'))
    .join('\n\n');
  await writeFile(path.join(failureDir, 'error.txt'), `${failure.title}\n${failure.specFile}:${failure.specLine}\n\n${errorText}\n`);

  return { failureDir, folderName, evidence: ['error.txt'] };
}

/**
 * Write one folder per failed test under `bundleDir`, and return the failures annotated with the
 * evidence files that were produced.
 *
 * @param {string} reportDir  unzipped `playwright-report` artifact
 * @param {string} bundleDir  where per-test folders are written
 * @param {{ includeTraces?: boolean }} [options]
 */
export async function extractPlaywrightFailures(reportDir, bundleDir, { includeTraces = true } = {}) {
  const { stats, topLevelErrors, failures } = collectFailures(await loadEmbeddedReport(reportDir));

  for (const [index, failure] of failures.entries()) {
    const { failureDir, folderName, evidence } = await startFailureFolder(bundleDir, failure, index);

    let screenshotCount = 0;
    for (const attachment of failure.attachments) {
      if (!attachment.path) {
        continue;
      }
      const source = path.join(reportDir, attachment.path);
      if (attachment.name === 'screenshot') {
        screenshotCount += 1;
        const target = `screenshot-${screenshotCount}.png`;
        await copyFile(source, path.join(failureDir, target));
        evidence.push(target);
      } else if (attachment.name === 'error-context') {
        // Playwright's accessibility snapshot of the page at the moment of failure — the fastest
        // way to tell "the element was never rendered" from "it rendered with a different name".
        await copyFile(source, path.join(failureDir, 'page-snapshot.md'));
        evidence.push('page-snapshot.md');
      } else if (attachment.name === 'trace' && includeTraces) {
        // The trace is tens of MB and already sits in the report folder — point at it there.
        failure.tracePath = path.join(reportDir, attachment.path);

        const { consoleMessages, networkFailures, requestCount, unreadable } = await readTraceSignals(source);
        const interesting = consoleMessages.filter(({ level }) => level === 'error' || level === 'warning' || level === 'pageerror');
        failure.traceSignals = unreadable
          ? null
          : { consoleErrors: interesting.length, networkFailures: networkFailures.length, requestCount };
        if (interesting.length) {
          await writeFile(
            path.join(failureDir, 'console-errors.txt'),
            interesting.map(({ level, text }) => `[${level}] ${text}`).join('\n'),
          );
          evidence.push('console-errors.txt');
        }
        if (networkFailures.length) {
          await writeFile(
            path.join(failureDir, 'network-failures.txt'),
            networkFailures
              .map(({ method, status, statusText, url }) => `${status} ${statusText || ''} ${method} ${url}`.trim())
              .join('\n'),
          );
          evidence.push('network-failures.txt');
        }
      } else if (attachment.name === 'video') {
        failure.videoPath = path.join(reportDir, attachment.path);
      }
    }

    if (failure.stdout?.trim()) {
      await writeFile(path.join(failureDir, 'stdout.txt'), stripAnsi(failure.stdout));
      evidence.push('stdout.txt');
    }
    if (failure.stderr?.trim()) {
      await writeFile(path.join(failureDir, 'stderr.txt'), stripAnsi(failure.stderr));
      evidence.push('stderr.txt');
    }

    failure.dir = folderName;
    failure.evidence = evidence;
    delete failure.attachments;
  }

  return { stats, topLevelErrors, failures };
}

/**
 * Same output shape as `extractPlaywrightFailures`, built from the `playwright-summary` artifact.
 * Use when the HTML report is unwanted (too large) or gone (expired): the error and the code frame
 * survive, the screenshots, page snapshot and trace do not.
 *
 * @param {string} jsonPath   downloaded `playwright-summary.json`
 * @param {string} bundleDir  where per-test folders are written
 */
export async function extractFailuresFromJsonSummary(jsonPath, bundleDir) {
  const { stats, topLevelErrors, failures } = collectFailuresFromJson(JSON.parse(await readFile(jsonPath, 'utf8')));

  for (const [index, failure] of failures.entries()) {
    const { folderName, evidence } = await startFailureFolder(bundleDir, failure, index);
    failure.dir = folderName;
    failure.evidence = evidence;
    delete failure.attachments;
  }

  return { stats, topLevelErrors, failures, textOnly: true };
}

/**
 * Repro command for a single failed test. `-g` matches against the full title path, which is what
 * `failure.title` already is.
 */
export function playwrightReproCommand(failure) {
  const grep = failure.title.replace(/["`$]/g, '.');
  return [
    `pnpm start-server-and-test --expect 200 'pnpm start:e2e' http://localhost:3333 \\`,
    `  'pnpm playwright test ${failure.specFile} --config apps/jetstream-e2e/playwright.config.ts -g "${grep}"'`,
  ].join('\n');
}
