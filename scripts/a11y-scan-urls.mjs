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
import { chromium } from '@playwright/test';

const WCAG_21_AA_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const RESULTS_DIR = 'apps/jetstream-e2e/a11y-results';

const [baseUrl, ...args] = process.argv.slice(2);
if (!baseUrl || !args.length) {
  console.error('Usage: node scripts/a11y-scan-urls.mjs <baseUrl> <path...> | --sitemap');
  process.exit(1);
}

/**
 * Resolve every page path a sitemap lists, re-rooted onto baseUrl (sitemaps carry the production
 * host). A <sitemapindex> lists child sitemaps rather than pages, so those are followed instead of
 * being scanned as pages themselves.
 */
async function fetchSitemapPaths(sitemapUrl, visited = new Set()) {
  if (visited.has(sitemapUrl.href)) {
    return [];
  }
  visited.add(sitemapUrl.href);

  const response = await fetch(sitemapUrl);
  if (!response.ok) {
    console.error(`Failed to fetch ${sitemapUrl}: HTTP ${response.status} ${response.statusText}`);
    process.exit(1);
  }
  const xml = await response.text();
  const locations = Array.from(xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)).map(([, location]) => new URL(location).pathname);

  if (/<sitemapindex[\s>]/i.test(xml)) {
    const childPaths = [];
    for (const childSitemapPath of locations) {
      childPaths.push(...(await fetchSitemapPaths(new URL(childSitemapPath, baseUrl), visited)));
    }
    return childPaths;
  }
  if (!locations.length) {
    const contentType = response.headers.get('content-type') || 'unknown content type';
    console.error(`${sitemapUrl} has no <loc> entries — not a sitemap? (${contentType})`);
    process.exit(1);
  }
  return locations;
}

let paths = args.filter((arg) => arg !== '--sitemap');
if (args.includes('--sitemap')) {
  paths = Array.from(new Set([...paths, ...(await fetchSitemapPaths(new URL('/sitemap.xml', baseUrl)))]));
}
if (!paths.length) {
  console.error('Nothing to scan: no paths were given and the sitemap resolved to zero pages.');
  process.exit(1);
}

mkdirSync(RESULTS_DIR, { recursive: true });

const browser = await chromium.launch();
// @axe-core/playwright requires a page created from an explicit context
const context = await browser.newContext();
const page = await context.newPage();
let totalSeriousOrCritical = 0;

for (const path of paths) {
  const url = new URL(path, baseUrl).toString();
  // Key includes host+port so the same path on different surfaces (landing vs docs) can't collide
  const { hostname, port, pathname, protocol } = new URL(url);
  const pathKey = (pathname.replace(/\/+$/, '') || '/').replaceAll('/', '_').replace(/^_/, '') || 'root';
  const scanKey = `url-${hostname}-${port || (protocol === 'https:' ? '443' : '80')}-${pathKey}`;
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
  } catch {
    // networkidle can time out on pages with long-polling even though navigation landed. Retry with
    // a lighter wait condition; if navigation itself fails, skip the scan so evidence is never
    // captured from the previously loaded page under this scanKey.
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await page.waitForTimeout(2000);
    } catch (error) {
      console.error(`${url}\n  failed to load, scan skipped: ${error.message}`);
      process.exitCode = 1;
      continue;
    }
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
