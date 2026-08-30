import { AxeBuilder } from '@axe-core/playwright';
import { expect, Page, TestInfo } from '@playwright/test';
import type { AxeResults } from 'axe-core';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Shared axe-core scan harness for the WCAG 2.1 AA program (see docs/accessibility/README.md).
 *
 * Every scan writes its full axe results to a11y-results/<scanKey>.json — these are the raw
 * evidence artifacts for the VPAT/ACR. Gating works as a ratchet against a committed baseline:
 * - A scanKey with no baseline entry is record-only, so brand new scans never break CI.
 * - A scanKey with a baseline entry fails only when a serious/critical rule violation appears
 *   that is not already in the baseline. Shrink the baseline as violations are remediated
 *   (scripts/a11y-merge-baseline.mjs regenerates it from a results directory).
 */

const WCAG_21_AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const GATED_IMPACTS = new Set(['serious', 'critical']);

const RESULTS_DIR = join(process.cwd(), 'apps/jetstream-e2e/a11y-results');
const BASELINE_PATH = join(process.cwd(), 'apps/jetstream-e2e/src/tests/a11y/a11y-baseline.json');

type A11yBaseline = Record<string, string[]>;

let cachedBaseline: A11yBaseline | null = null;

function getBaseline(): A11yBaseline {
  if (!cachedBaseline) {
    cachedBaseline = existsSync(BASELINE_PATH) ? (JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) as A11yBaseline) : {};
  }
  return cachedBaseline;
}

export async function runA11yScan(page: Page, testInfo: TestInfo, scanKey: string): Promise<AxeResults> {
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

  const gatedRuleIds = results.violations
    .filter(({ impact }) => impact && GATED_IMPACTS.has(impact))
    .map(({ id }) => id)
    .sort();

  const baselineRuleIds = getBaseline()[scanKey];
  if (!baselineRuleIds) {
    // No baseline yet for this scan — record-only so newly added scans can't break CI.
    // Run scripts/a11y-merge-baseline.mjs over the results directory to add it to the ratchet.
    console.warn(`[a11y] ${scanKey}: no baseline entry (record-only). serious/critical rules: ${gatedRuleIds.join(', ') || 'none'}`);
    return results;
  }

  const newRuleIds = gatedRuleIds.filter((ruleId) => !baselineRuleIds.includes(ruleId));
  expect(newRuleIds, `New serious/critical axe violations on "${scanKey}" (not in a11y-baseline.json): ${newRuleIds.join(', ')}`).toEqual(
    [],
  );

  return results;
}
