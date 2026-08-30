#!/usr/bin/env node
/**
 * Ad-hoc axe-core WCAG 2.1 A/AA scan over arbitrary URLs — used for the surfaces that don't have
 * an authenticated Playwright suite (landing/auth pages, built docs site, canvas).
 *
 * Usage:
 *   node scripts/a11y-scan-urls.mjs <baseUrl> <path> [path...]
 *   node scripts/a11y-scan-urls.mjs http://localhost:3000 / /pricing /auth/login /auth/signup
 *   node scripts/a11y-scan-urls.mjs http://localhost:3000 --sitemap   # scan every URL in /sitemap.xml
 *
 * Results are written to apps/jetstream-e2e/a11y-results/ using url-derived scan keys, so
 * scripts/a11y-merge-baseline.mjs can fold them into the same baseline/evidence set.
 */
import { AxeBuilder } from '@axe-core/playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';

const WCAG_21_AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const RESULTS_DIR = 'apps/jetstream-e2e/a11y-results';

const [baseUrl, ...args] = process.argv.slice(2);
if (!baseUrl || (!args.length && !args.includes('--sitemap'))) {
  console.error('Usage: node scripts/a11y-scan-urls.mjs <baseUrl> <path...> | --sitemap');
  process.exit(1);
}

let paths = args.filter((arg) => arg !== '--sitemap');
if (args.includes('--sitemap')) {
  const sitemapXml = await fetch(new URL('/sitemap.xml', baseUrl)).then((res) => res.text());
  const sitemapPaths = Array.from(sitemapXml.matchAll(/<loc>([^<]+)<\/loc>/g)).map(([, loc]) => new URL(loc).pathname);
  paths = Array.from(new Set([...paths, ...sitemapPaths]));
}

mkdirSync(RESULTS_DIR, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage();
let totalSeriousOrCritical = 0;

for (const path of paths) {
  const url = new URL(path, baseUrl).toString();
  const scanKey = `url-${(new URL(url).pathname.replace(/\/+$/, '') || '/').replaceAll('/', '_').replace(/^_/, '') || 'root'}`;
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  } catch {
    await page.waitForTimeout(2000);
  }
  const results = await new AxeBuilder({ page }).withTags(WCAG_21_AA_TAGS).analyze();

  writeFileSync(
    join(RESULTS_DIR, `${scanKey}.json`),
    JSON.stringify(
      {
        scanKey,
        url,
        timestamp: results.timestamp,
        axeVersion: results.testEngine?.version,
        violations: results.violations,
        incomplete: results.incomplete,
      },
      null,
      2,
    ),
  );

  const seriousOrCritical = results.violations.filter(({ impact }) => impact === 'serious' || impact === 'critical');
  totalSeriousOrCritical += seriousOrCritical.length;
  const summary = results.violations.map(({ id, impact, nodes }) => `${id}(${impact},${nodes.length})`).join(' ');
  console.log(`${url}\n  violations: ${results.violations.length ? summary : 'none'}`);
}

await browser.close();
console.log(`\nScanned ${paths.length} page(s); ${totalSeriousOrCritical} serious/critical rule violation(s). Results in ${RESULTS_DIR}/`);
