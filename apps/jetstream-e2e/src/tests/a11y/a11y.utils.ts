import { AxeBuilder } from '@axe-core/playwright';
import { expect, Page, TestInfo } from '@playwright/test';
import type { AxeResults } from 'axe-core';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Shared axe-core scan harness for the WCAG 2.1 AA program (see docs/accessibility/README.md).
 *
 * Every scan writes its full axe results to a11y-results/<scanKey>.json — these are the raw
 * evidence artifacts for the VPAT/ACR. Gating works as a ratchet against the committed
 * a11y-baseline.json, which maps each scan key to the serious/critical axe rules it is still
 * allowed to violate and how many nodes each may flag, e.g.
 * `"route-CREATE_FIELDS": { "nested-interactive": 53 }`:
 * - Every scan key MUST have a baseline entry. A scan without one fails and tells the developer to
 *   add the key (an empty `{}` entry gates it at zero violations), so new routes and states are
 *   baselined explicitly instead of silently running record-only.
 * - A scan fails when a serious/critical rule fires that is not in its entry, or when a baselined
 *   rule flags more nodes than its count allows.
 * - The baseline only shrinks: scripts/a11y-merge-baseline.mjs folds a results directory back in
 *   (lower counts, dropped rules, new keys) and refuses growth unless --allow-growth is passed
 *   deliberately.
 *
 * Node counts are whatever the page renders for the E2E org, so they can move with the data (the
 * CREATE_FIELDS / PERMISSION_* counts are one per listed sobject). A count that rises for that
 * reason still needs a deliberate --allow-growth merge — cheap, and it keeps "more violating
 * nodes" from ever slipping in unnoticed.
 */

const WCAG_21_AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const GATED_IMPACTS = new Set(['serious', 'critical']);

const RESULTS_DIR = join(process.cwd(), 'apps/jetstream-e2e/a11y-results');
const BASELINE_PATH = join(process.cwd(), 'apps/jetstream-e2e/src/tests/a11y/a11y-baseline.json');

/** Gated axe rule id -> maximum number of nodes it may flag. */
type A11yBaselineEntry = Record<string, number>;
type A11yBaseline = Record<string, A11yBaselineEntry>;

let cachedBaseline: A11yBaseline | null = null;

function getBaseline(): A11yBaseline {
  if (!cachedBaseline) {
    cachedBaseline = existsSync(BASELINE_PATH) ? (JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as A11yBaseline) : {};
  }
  return cachedBaseline;
}

/**
 * Returns the baseline entry for a scan key and fails when there is none. Specs call this before
 * any page work so an un-baselined key fails fast instead of after a full page load.
 */
export function assertBaselineEntry(scanKey: string): A11yBaselineEntry {
  const baselineEntry = getBaseline()[scanKey];
  if (!baselineEntry) {
    throw new Error(
      `[a11y] "${scanKey}" has no entry in a11y-baseline.json. Every scan must be baselined explicitly: add "${scanKey}": {} to the file ` +
        `(or run scripts/a11y-merge-baseline.mjs over a results directory) so the scan is gated.`,
    );
  }
  return baselineEntry;
}

export async function runA11yScan(page: Page, testInfo: TestInfo, scanKey: string): Promise<AxeResults> {
  const baselineEntry = assertBaselineEntry(scanKey);

  const results = await new AxeBuilder({ page }).withTags(WCAG_21_AA_TAGS).analyze();

  mkdirSync(RESULTS_DIR, { recursive: true });
  writeFileSync(
    join(RESULTS_DIR, `${scanKey}.json`),
    JSON.stringify(
      {
        scanKey,
        url: page.url(),
        timestamp: results.timestamp,
        axeVersion: results.testEngine?.version,
        violations: results.violations,
        incomplete: results.incomplete,
      },
      null,
      2,
    ),
  );

  const summary = results.violations.map(({ id, impact, description, nodes }) => ({
    id,
    impact,
    description,
    nodeCount: nodes.length,
    targets: nodes.slice(0, 5).map(({ target }) => target.join(' ')),
  }));
  await testInfo.attach(`a11y-${scanKey}`, { body: JSON.stringify(summary, null, 2), contentType: 'application/json' });

  const gatedViolations = results.violations.filter(({ impact }) => impact && GATED_IMPACTS.has(impact));
  const regressions = gatedViolations.flatMap(({ id, impact, nodes }) => {
    const allowedNodeCount = baselineEntry[id];
    if (allowedNodeCount === undefined) {
      return [`${id} (${impact}): ${nodes.length} node(s), rule is not in the baseline entry`];
    }
    if (nodes.length > allowedNodeCount) {
      return [`${id} (${impact}): ${nodes.length} node(s), baseline allows ${allowedNodeCount}`];
    }
    if (nodes.length < allowedNodeCount) {
      console.info(
        `[a11y] ${scanKey}: ${id} flags ${nodes.length} of ${allowedNodeCount} baselined node(s) — run scripts/a11y-merge-baseline.mjs to ratchet the baseline down`,
      );
    }
    return [];
  });
  expect(regressions, `Serious/critical axe regressions on "${scanKey}" vs a11y-baseline.json:\n  ${regressions.join('\n  ')}`).toEqual([]);

  return results;
}
