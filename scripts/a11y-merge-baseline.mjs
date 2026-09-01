#!/usr/bin/env node
/**
 * Merge axe scan results into apps/jetstream-e2e/src/tests/a11y/a11y-baseline.json.
 *
 * The baseline is the accessibility ratchet. Per scan key it lists the serious/critical axe rules that
 * are known and tracked in the remediation backlog, each with the number of nodes it may flag:
 *
 *   { "route-CREATE_FIELDS": { "nested-interactive": 53 }, "route-HOME": {} }
 *
 * CI (a11y.utils.ts) fails a scan on any gated rule missing from its entry and on a node count above
 * the baselined one, so the baseline should only ever shrink. This script folds a results directory
 * back into it:
 *
 * - keys absent from the results are kept unchanged, so a partial run (one CI shard, one spec) never
 *   drops gating for the scans it didn't cover
 * - keys present in the results are replaced by what was scanned: rules that no longer fire are
 *   dropped and node counts go down
 * - keys present in the results but not yet baselined are added, gating them from now on
 *
 * Anything that would loosen the ratchet — a rule missing from the existing entry, a node count above
 * the baselined one, or a new key that already carries serious/critical violations — is reported as
 * growth and aborts the run (exit 1, baseline untouched) unless `--allow-growth` is passed. Pass it
 * deliberately, once the finding has been reviewed and logged in the remediation backlog
 * (docs/accessibility/audit-2026/findings.md).
 *
 * The script also refuses to write when a results directory is missing or when zero result files were
 * merged, so a typo'd path or an empty artifact can't rewrite the baseline.
 *
 * Usage:
 *   node scripts/a11y-merge-baseline.mjs [--allow-growth] [resultsDir...]
 *
 * Defaults to apps/jetstream-e2e/a11y-results. Pass multiple directories to merge downloaded CI shard
 * artifacts (a11y-results-1 ... a11y-results-4). The written file is run through oxfmt so the
 * committed baseline is byte-stable.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const GATED_IMPACTS = new Set(['serious', 'critical']);
const BASELINE_PATH = 'apps/jetstream-e2e/src/tests/a11y/a11y-baseline.json';
const DEFAULT_RESULTS_DIR = 'apps/jetstream-e2e/a11y-results';
const ALLOW_GROWTH_FLAG = '--allow-growth';

const USAGE = `Usage: node scripts/a11y-merge-baseline.mjs [${ALLOW_GROWTH_FLAG}] [resultsDir...]

  resultsDir       One or more directories of <scanKey>.json axe results
                   (default: ${DEFAULT_RESULTS_DIR})
  ${ALLOW_GROWTH_FLAG}   Accept gated rules that are not yet baselined, node counts above the baselined
                   ones, and new scan keys that already carry violations. Without it any growth
                   aborts the merge and the baseline is left untouched.
  --help           Show this message`;

/** Exit without touching the baseline. */
function abort(message) {
  console.error(message);
  console.error(`\n${BASELINE_PATH} was not modified.`);
  process.exit(1);
}

/** Locale-independent ordering so the committed file is byte-stable on every machine. */
function compareCodePoints(left, right) {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function describeEntry(ruleCounts) {
  const ruleIds = Object.keys(ruleCounts).sort(compareCodePoints);
  return ruleIds.length ? ruleIds.map((ruleId) => `${ruleId}=${ruleCounts[ruleId]}`).join(', ') : 'no serious/critical violations';
}

const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  console.log(USAGE);
  process.exit(0);
}
const unknownFlags = args.filter((arg) => arg.startsWith('-') && arg !== ALLOW_GROWTH_FLAG);
if (unknownFlags.length) {
  abort(`Unknown option(s): ${unknownFlags.join(', ')}\n\n${USAGE}`);
}
const allowGrowth = args.includes(ALLOW_GROWTH_FLAG);
const resultsDirs = args.filter((arg) => !arg.startsWith('-'));
if (!resultsDirs.length) {
  resultsDirs.push(DEFAULT_RESULTS_DIR);
}

const missingDirs = resultsDirs.filter((dir) => !existsSync(dir));
if (missingDirs.length) {
  abort(`Results directory not found: ${missingDirs.join(', ')}`);
}

// Null prototypes throughout: scan keys and rule ids come from JSON on disk, so a key like
// "__proto__" must be stored as an ordinary entry instead of mutating the object's prototype.
const scanned = Object.create(null);
let fileCount = 0;
for (const dir of resultsDirs) {
  for (const file of readdirSync(dir).filter((name) => name.endsWith('.json'))) {
    const { scanKey, violations } = JSON.parse(readFileSync(join(dir, file), 'utf8'));
    if (!scanKey) {
      continue;
    }
    fileCount++;
    const ruleCounts = (scanned[scanKey] ??= Object.create(null));
    for (const { id, impact, nodes } of violations || []) {
      if (GATED_IMPACTS.has(impact)) {
        // The same key scanned more than once (several shards or directories) keeps the highest count seen
        ruleCounts[id] = Math.max(ruleCounts[id] || 0, nodes.length);
      }
    }
  }
}
if (!fileCount) {
  abort(`No scan result files (*.json with a scanKey) found in: ${resultsDirs.join(', ')}`);
}

const existing = Object.assign(Object.create(null), existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8')) : {});
const malformedKeys = Object.entries(existing)
  .filter(([, entry]) => !isPlainObject(entry))
  .map(([scanKey]) => scanKey);
if (malformedKeys.length) {
  abort(`${BASELINE_PATH} entries must be { ruleId: nodeCount } objects; found another shape for: ${malformedKeys.join(', ')}`);
}

const merged = Object.assign(Object.create(null), existing);
const changes = [];
const growth = [];
for (const [scanKey, ruleCounts] of Object.entries(scanned)) {
  const existingEntry = existing[scanKey];
  if (!existingEntry) {
    changes.push(`+ ${scanKey}: new scan key (${describeEntry(ruleCounts)})`);
    for (const [ruleId, count] of Object.entries(ruleCounts)) {
      growth.push(`${scanKey}: ${ruleId} flags ${count} node(s) on a scan key that is not baselined yet`);
    }
  } else {
    for (const [ruleId, count] of Object.entries(ruleCounts)) {
      const allowedCount = existingEntry[ruleId];
      if (allowedCount === undefined) {
        growth.push(`${scanKey}: ${ruleId} is not in the baseline entry (${count} node(s))`);
      } else if (count > allowedCount) {
        growth.push(`${scanKey}: ${ruleId} grew from ${allowedCount} to ${count} node(s)`);
      } else if (count < allowedCount) {
        changes.push(`- ${scanKey}: ${ruleId} ${allowedCount} -> ${count} node(s)`);
      }
    }
    for (const ruleId of Object.keys(existingEntry)) {
      if (!(ruleId in ruleCounts)) {
        changes.push(`- ${scanKey}: ${ruleId} no longer fires, removed`);
      }
    }
  }
  merged[scanKey] = ruleCounts;
}

if (growth.length && !allowGrowth) {
  abort(
    `Refusing to grow the baseline. Fix the regression, or re-run with ${ALLOW_GROWTH_FLAG} once the finding is logged in the remediation backlog:\n  ${growth.join('\n  ')}`,
  );
}

// Written directly in oxfmt's shape (one key per line, inline entries) so the diff is minimal and the
// file is byte-stable regardless of who runs the merge.
function formatEntry(ruleCounts) {
  const ruleIds = Object.keys(ruleCounts).sort(compareCodePoints);
  if (!ruleIds.length) {
    return '{}';
  }
  return `{ ${ruleIds.map((ruleId) => `${JSON.stringify(ruleId)}: ${ruleCounts[ruleId]}`).join(', ')} }`;
}

const scanKeys = Object.keys(merged).sort(compareCodePoints);
const lines = scanKeys.map((scanKey) => `  ${JSON.stringify(scanKey)}: ${formatEntry(merged[scanKey])}`);
writeFileSync(BASELINE_PATH, `{\n${lines.join(',\n')}\n}\n`);

// Run the repo formatter over the result so `pnpm format:check` can never disagree with this script
// (an entry that outgrows the print width is the one case where oxfmt reshapes it).
const oxfmtBin = join(dirname(createRequire(import.meta.url).resolve('oxfmt/package.json')), 'bin', 'oxfmt');
execFileSync(process.execPath, [oxfmtBin, BASELINE_PATH], { stdio: 'inherit' });

const unchangedCount = scanKeys.length - Object.keys(scanned).length;
const totalRules = scanKeys.reduce((count, scanKey) => count + Object.keys(merged[scanKey]).length, 0);
console.log(`Merged ${fileCount} scan result file(s) into ${BASELINE_PATH}`);
console.log(
  `${scanKeys.length} scan keys (${unchangedCount} not in these results, kept unchanged), ${totalRules} baselined serious/critical rule(s)`,
);
if (changes.length) {
  console.log(`Changes:\n  ${changes.join('\n  ')}`);
} else {
  console.log('Changes: none');
}
if (growth.length) {
  console.log(`Growth accepted via ${ALLOW_GROWTH_FLAG}:\n  ${growth.join('\n  ')}`);
}
