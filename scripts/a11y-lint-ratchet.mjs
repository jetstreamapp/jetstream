#!/usr/bin/env node
/**
 * Accessibility lint ratchet — the source-level counterpart of the axe baseline in
 * apps/jetstream-e2e/src/tests/a11y/a11y-baseline.json (see docs/accessibility/README.md).
 *
 * Three checks, gated against tools/oxlint/jsx-a11y-baseline.json:
 *
 * 1. `jsx-a11y` rules still at `warn` in .oxlintrc.json. oxlint cannot fail on them without also
 *    failing on the legacy sites, so the baseline records the allowed hit count per file and rule
 *    and this script fails when any file exceeds its count (a file without an entry is allowed
 *    zero). Rules at `error` are enforced by `pnpm lint` and are not tracked here.
 * 2. Every `libs/ui` component spec (`__tests__/*.spec.tsx`) must call `axeScan()` from
 *    @jetstream/test-utils unless it is listed in `axeScanExemptSpecs`.
 * 3. Every swept `APP_ROUTES` key needs a `route-<KEY>` entry in the axe baseline, so a new route is
 *    gated from its first commit instead of failing a 20-minute E2E job later.
 *
 * The baseline only shrinks: `--update` drops hits and exemptions that no longer apply and refuses
 * to record growth unless `--allow-growth` is passed deliberately (log the reason in
 * docs/accessibility/audit-2026/findings.md, the same as for the axe baseline).
 *
 * Usage:
 *   node scripts/a11y-lint-ratchet.mjs                          # check (pre-commit and CI)
 *   node scripts/a11y-lint-ratchet.mjs --update                 # shrink the baseline to the current state
 *   node scripts/a11y-lint-ratchet.mjs --update --allow-growth  # record new hits/exemptions on purpose
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const ROOT = process.cwd();
const BASELINE_PATH = join(ROOT, 'tools/oxlint/jsx-a11y-baseline.json');
const AXE_BASELINE_PATH = join(ROOT, 'apps/jetstream-e2e/src/tests/a11y/a11y-baseline.json');
const ROUTER_PATH = join(ROOT, 'libs/shared/ui-router/src/lib/ui-router.ts');
const PAGE_SWEEP_SPEC_PATH = join(ROOT, 'apps/jetstream-e2e/src/tests/a11y/page-sweep.spec.ts');
const UI_LIB_SRC = join(ROOT, 'libs/ui/src');

const args = new Set(process.argv.slice(2));
const shouldUpdate = args.has('--update');
const allowGrowth = args.has('--allow-growth');

function toPosix(filePath) {
  return filePath.split(sep).join('/');
}

function readBaseline() {
  if (!existsSync(BASELINE_PATH)) {
    return { lint: {}, axeScanExemptSpecs: [] };
  }
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  return { lint: baseline.lint ?? {}, axeScanExemptSpecs: baseline.axeScanExemptSpecs ?? [] };
}

function runOxlint() {
  const options = { cwd: ROOT, encoding: 'utf8', maxBuffer: 512 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] };
  let stdout;
  try {
    stdout = execFileSync('pnpm', ['exec', 'oxlint', '--format', 'json', '.'], options);
  } catch (error) {
    // oxlint exits 1 when error-level diagnostics exist, but the JSON report is still complete.
    // `pnpm lint` is the gate for those; this script only reads the warn-tier a11y hits.
    if (!error.stdout) {
      throw error;
    }
    stdout = error.stdout;
  }
  return JSON.parse(stdout).diagnostics;
}

/** file -> rule -> count, plus the `line:column` of every hit for the failure report. */
function collectLintHits(diagnostics) {
  const hits = {};
  const locations = {};
  for (const { code, severity, filename, labels } of diagnostics) {
    const ruleMatch = /^jsx-a11y\((.+)\)$/.exec(code ?? '');
    if (!ruleMatch || severity !== 'warning') {
      continue;
    }
    const rule = ruleMatch[1];
    const file = toPosix(filename);
    hits[file] ??= {};
    hits[file][rule] = (hits[file][rule] ?? 0) + 1;
    const span = labels?.[0]?.span;
    (locations[`${file}|${rule}`] ??= []).push(span ? `${span.line}:${span.column}` : '?');
  }
  return { hits, locations };
}

function compareLint(baselineLint, currentHits, locations) {
  const growth = [];
  const shrink = [];
  const files = [...new Set([...Object.keys(baselineLint), ...Object.keys(currentHits)])].sort();
  for (const file of files) {
    const rules = [...new Set([...Object.keys(baselineLint[file] ?? {}), ...Object.keys(currentHits[file] ?? {})])].sort();
    for (const rule of rules) {
      const allowed = baselineLint[file]?.[rule] ?? 0;
      const current = currentHits[file]?.[rule] ?? 0;
      if (current > allowed) {
        growth.push({ file, rule, allowed, current, lines: locations[`${file}|${rule}`] ?? [] });
      } else if (current < allowed) {
        shrink.push({ file, rule, allowed, current });
      }
    }
  }
  return { growth, shrink };
}

function listUiComponentSpecs() {
  return readdirSync(UI_LIB_SRC, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.spec.tsx') && toPosix(entry.parentPath).endsWith('/__tests__'))
    .map((entry) => toPosix(relative(ROOT, join(entry.parentPath, entry.name))))
    .sort();
}

function compareAxeScanSpecs(exemptSpecs) {
  const specsWithoutAxeScan = listUiComponentSpecs().filter((spec) => !readFileSync(join(ROOT, spec), 'utf8').includes('axeScan('));
  const exempt = new Set(exemptSpecs);
  const stillWithout = new Set(specsWithoutAxeScan);
  return {
    growth: specsWithoutAxeScan.filter((spec) => !exempt.has(spec)),
    shrink: exemptSpecs.filter((spec) => !stillWithout.has(spec)),
    current: specsWithoutAxeScan,
  };
}

/**
 * The route keys page-sweep.spec.ts scans: every APP_ROUTES entry whose ROUTE is in-app (not an
 * absolute URL) and that the spec does not list in EXCLUDED_ROUTES. Both files are parsed textually
 * so this stays a plain node script; either pattern failing to match aborts loudly.
 */
function listSweptRouteKeys() {
  const routerSource = readFileSync(ROUTER_PATH, 'utf8');
  const start = routerSource.indexOf('export const APP_ROUTES');
  // The map closes with `} as const;` at column 0; every nested close is indented.
  const end = routerSource.indexOf('\n}', start);
  if (start === -1 || end === -1) {
    throw new Error(`Could not find the APP_ROUTES block in ${toPosix(relative(ROOT, ROUTER_PATH))}`);
  }
  // Top-level entries are `  KEY: {` … `  },`; nested objects are indented deeper.
  const entryPattern = /^ {2}([A-Z0-9_]+): \{\n([\s\S]*?)^ {2}\},?$/gm;
  const routeKeys = [];
  for (const [, key, body] of routerSource.slice(start, end).matchAll(entryPattern)) {
    if (!/ROUTE: ['"`]https?:/.test(body)) {
      routeKeys.push(key);
    }
  }
  if (routeKeys.length === 0) {
    throw new Error(`Parsed zero APP_ROUTES entries from ${toPosix(relative(ROOT, ROUTER_PATH))} — the route map layout changed`);
  }

  const sweepSource = readFileSync(PAGE_SWEEP_SPEC_PATH, 'utf8');
  const excludedMatch = /EXCLUDED_ROUTES = new Set\(\[([^\]]*)\]\)/.exec(sweepSource);
  if (!excludedMatch) {
    throw new Error(`Could not find EXCLUDED_ROUTES in ${toPosix(relative(ROOT, PAGE_SWEEP_SPEC_PATH))}`);
  }
  const excludedKeys = new Set([...excludedMatch[1].matchAll(/'([A-Z0-9_]+)'/g)].map(([, key]) => key));
  return routeKeys.filter((key) => !excludedKeys.has(key));
}

function findRoutesMissingFromAxeBaseline() {
  const axeBaseline = JSON.parse(readFileSync(AXE_BASELINE_PATH, 'utf8'));
  return listSweptRouteKeys()
    .map((key) => `route-${key}`)
    .filter((scanKey) => !axeBaseline[scanKey]);
}

function sortedLint(hits) {
  const sorted = {};
  for (const file of Object.keys(hits).sort()) {
    sorted[file] = Object.fromEntries(
      Object.keys(hits[file])
        .sort()
        .map((rule) => [rule, hits[file][rule]]),
    );
  }
  return sorted;
}

function writeBaseline(lint, axeScanExemptSpecs) {
  const baseline = {
    $comment:
      'Accessibility lint ratchet — maintained by scripts/a11y-lint-ratchet.mjs (`pnpm a11y:lint-ratchet --update`). ' +
      '`lint` is the allowed number of warn-tier jsx-a11y hits per file and rule; `axeScanExemptSpecs` lists the ' +
      'libs/ui component specs that predate the axeScan() requirement. Both only shrink. See docs/accessibility/README.md.',
    lint: sortedLint(lint),
    axeScanExemptSpecs: [...axeScanExemptSpecs].sort(),
  };
  writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
}

const baseline = readBaseline();
const { hits, locations } = collectLintHits(runOxlint());
const lint = compareLint(baseline.lint, hits, locations);
const axeScan = compareAxeScanSpecs(baseline.axeScanExemptSpecs);
const missingRouteEntries = findRoutesMissingFromAxeBaseline();

let hasGrowth = false;

if (lint.growth.length > 0) {
  hasGrowth = true;
  console.error('[a11y-lint-ratchet] New warn-tier jsx-a11y violations (see .oxlintrc.json for the rule tiers):');
  for (const { file, rule, allowed, current, lines } of lint.growth) {
    console.error(`  ${file} — ${rule}: ${current} hit(s), baseline allows ${allowed} — at ${lines.join(', ')}`);
  }
  console.error(
    '  Fix them (run `pnpm exec oxlint <file>` for the details). Only when a hit is a false positive, suppress it with a\n' +
      '  commented `eslint-disable-next-line` or record it with `pnpm a11y:lint-ratchet --update --allow-growth`.',
  );
}

if (axeScan.growth.length > 0) {
  hasGrowth = true;
  console.error('[a11y-lint-ratchet] libs/ui component specs without an axeScan() assertion:');
  for (const spec of axeScan.growth) {
    console.error(`  ${spec}`);
  }
  console.error(
    '  Add `await axeScan(container)` from @jetstream/test-utils to a test that renders the component in its interactive\n' +
      '  state (see libs/ui/src/lib/modal/__tests__/Modal.spec.tsx). Exempt a spec only if it renders no interactive UI:\n' +
      '  `pnpm a11y:lint-ratchet --update --allow-growth`.',
  );
}

if (missingRouteEntries.length > 0) {
  console.error('[a11y-lint-ratchet] Swept APP_ROUTES without an axe baseline entry:');
  for (const scanKey of missingRouteEntries) {
    console.error(`  "${scanKey}": {}`);
  }
  console.error(
    '  Add the entries above to apps/jetstream-e2e/src/tests/a11y/a11y-baseline.json so the route is gated at zero\n' +
      '  violations, or add the key to EXCLUDED_ROUTES in page-sweep.spec.ts with a reason.',
  );
}

if (shouldUpdate) {
  if (hasGrowth && !allowGrowth) {
    console.error('[a11y-lint-ratchet] Refusing to record growth without --allow-growth; baseline left untouched.');
    process.exit(1);
  }
  writeBaseline(hits, axeScan.current);
  const lintTotal = Object.values(hits).reduce(
    (sum, rules) => sum + Object.values(rules).reduce((ruleSum, count) => ruleSum + count, 0),
    0,
  );
  console.log(
    `[a11y-lint-ratchet] Wrote ${toPosix(relative(ROOT, BASELINE_PATH))}: ${lintTotal} warn-tier hit(s) in ${Object.keys(hits).length} file(s), ` +
      `${axeScan.current.length} spec(s) exempt from axeScan().`,
  );
  process.exit(missingRouteEntries.length > 0 ? 1 : 0);
}

if (lint.shrink.length > 0 || axeScan.shrink.length > 0) {
  console.log('[a11y-lint-ratchet] The baseline can shrink — run `pnpm a11y:lint-ratchet --update` to lock in:');
  for (const { file, rule, allowed, current } of lint.shrink) {
    console.log(`  ${file} — ${rule}: ${current} hit(s), baseline allows ${allowed}`);
  }
  for (const spec of axeScan.shrink) {
    console.log(`  ${spec} now calls axeScan() and no longer needs its exemption`);
  }
}

if (hasGrowth || missingRouteEntries.length > 0) {
  process.exit(1);
}

const baselineTotal = Object.values(baseline.lint).reduce(
  (sum, rules) => sum + Object.values(rules).reduce((ruleSum, count) => ruleSum + count, 0),
  0,
);
console.log(
  `[a11y-lint-ratchet] ok — ${baselineTotal} baselined warn-tier jsx-a11y hit(s) in ${Object.keys(baseline.lint).length} file(s), ` +
    `${baseline.axeScanExemptSpecs.length} libs/ui spec(s) exempt from axeScan(), every swept route baselined.`,
);
