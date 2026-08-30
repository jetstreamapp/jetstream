#!/usr/bin/env node
/**
 * Regenerate apps/jetstream-e2e/src/tests/a11y/a11y-baseline.json from axe scan results.
 *
 * The baseline is the accessibility ratchet: per scan key, the serious/critical axe rule ids that
 * are known and tracked in the remediation backlog. CI fails only on violations NOT in this file,
 * so regenerate it after a full local/CI run to establish it, and re-run after remediation lands
 * to shrink it (it should only ever shrink — review the diff before committing).
 *
 * Usage:
 *   node scripts/a11y-merge-baseline.mjs [resultsDir...]
 *
 * Defaults to apps/jetstream-e2e/a11y-results. Pass multiple directories to merge downloaded CI
 * shard artifacts (a11y-results-1 ... a11y-results-4).
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const GATED_IMPACTS = new Set(['serious', 'critical']);
const BASELINE_PATH = 'apps/jetstream-e2e/src/tests/a11y/a11y-baseline.json';

const resultsDirs = process.argv.slice(2).length ? process.argv.slice(2) : ['apps/jetstream-e2e/a11y-results'];

const baseline = {};
let fileCount = 0;

for (const dir of resultsDirs) {
  if (!existsSync(dir)) {
    console.error(`Results directory not found: ${dir}`);
    process.exitCode = 1;
    continue;
  }
  for (const file of readdirSync(dir).filter((name) => name.endsWith('.json'))) {
    const { scanKey, violations } = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    if (!scanKey) {
      continue;
    }
    fileCount++;
    const ruleIds = (violations || []).filter(({ impact }) => GATED_IMPACTS.has(impact)).map(({ id }) => id);
    baseline[scanKey] = Array.from(new Set([...(baseline[scanKey] || []), ...ruleIds])).sort();
  }
}

const sortedBaseline = Object.fromEntries(Object.entries(baseline).sort(([a], [b]) => a.localeCompare(b)));
writeFileSync(BASELINE_PATH, `${JSON.stringify(sortedBaseline, null, 2)}\n`);

const totalViolations = Object.values(sortedBaseline).reduce((count, ruleIds) => count + ruleIds.length, 0);
console.log(`Merged ${fileCount} scan result file(s) into ${BASELINE_PATH}`);
console.log(`${Object.keys(sortedBaseline).length} scan keys, ${totalViolations} baselined serious/critical rule entries`);
