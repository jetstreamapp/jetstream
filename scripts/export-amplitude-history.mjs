#!/usr/bin/env node

/**
 * One-off archival export of raw Amplitude event data before the account is decommissioned
 * (Amplitude -> Better Stack RUM migration). Also emits the daily-rollup seed SQL used to
 * backfill the AnalyticsEventRollup table so the rolling YEAR/MONTH/WEEK summary windows are
 * correct from day one on Better Stack.
 *
 * Uses the Amplitude Export API (https://amplitude.com/docs/apis/analytics/export), which returns
 * a zip of gzipped NDJSON files per requested range. Requests are chunked by month to stay under
 * the API's per-request size limits. Credentials are the PROJECT-scoped api/secret key pair
 * (Amplitude -> Settings -> Projects -> <project> -> General), NOT a user API key - export each
 * project ("jetstream-dev" 306465 and "jetstream" 306468) separately with its own key pair.
 *
 * Usage:
 *   node scripts/export-amplitude-history.mjs --api-key <key> --secret-key <secret> \
 *     --start 2020-09 --end 2026-08 --out tmp/amplitude-export/jetstream-dev
 *
 *   # after export completes, generate the rollup seed SQL from the downloaded archives:
 *   node scripts/export-amplitude-history.mjs --rollup --out tmp/amplitude-export/jetstream-dev
 *
 * Env fallbacks: AMPLITUDE_API_KEY / AMPLITUDE_SECRET_KEY (same vars the old cron job used).
 * The seed SQL upserts rows as (date, type in LOAD|QUERY, count) matching the semantics of the
 * old Amplitude charts: LOAD = sum(numRecords) on load_Submitted, QUERY = count of query_ExecuteQuery.
 */

import { execFileSync } from 'node:child_process';
import { createWriteStream, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { gunzipSync } from 'node:zlib';
import dotenv from 'dotenv';

dotenv.config();

const args = process.argv.slice(2);

function getArg(name, fallback = undefined) {
  const index = args.indexOf(`--${name}`);
  if (index === -1 || index === args.length - 1) {
    return fallback;
  }
  return args[index + 1];
}

const apiKey = getArg('api-key', process.env.AMPLITUDE_API_KEY);
const secretKey = getArg('secret-key', process.env.AMPLITUDE_SECRET_KEY);
const outDir = resolve(getArg('out', 'tmp/amplitude-export'));
const startMonth = getArg('start', '2020-09');
const endMonth = getArg('end', new Date().toISOString().slice(0, 7));
const rollupOnly = args.includes('--rollup');

const LOAD_EVENT = 'load_Submitted';
const QUERY_EVENT = 'query_ExecuteQuery';

function* monthRange(start, end) {
  let [year, month] = start.split('-').map(Number);
  const [endYear, endMonth] = end.split('-').map(Number);
  while (year < endYear || (year === endYear && month <= endMonth)) {
    yield { year, month };
    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
  }
}

async function downloadArchives() {
  if (!apiKey || !secretKey) {
    console.error('Missing credentials: pass --api-key/--secret-key or set AMPLITUDE_API_KEY/AMPLITUDE_SECRET_KEY');
    process.exit(1);
  }
  mkdirSync(outDir, { recursive: true });
  const authHeader = `Basic ${Buffer.from(`${apiKey}:${secretKey}`).toString('base64')}`;

  for (const { year, month } of monthRange(startMonth, endMonth)) {
    const monthStr = String(month).padStart(2, '0');
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const start = `${year}${monthStr}01T00`;
    const end = `${year}${monthStr}${lastDay}T23`;
    const outFile = join(outDir, `amplitude-${year}-${monthStr}.zip`);

    if (existsSync(outFile)) {
      console.log(`SKIP ${outFile} (already downloaded)`);
      continue;
    }

    console.log(`Downloading ${year}-${monthStr}...`);
    const response = await fetch(`https://amplitude.com/api/2/export?start=${start}&end=${end}`, {
      headers: { Authorization: authHeader },
    });

    if (response.status === 404) {
      // No data for this range
      console.log(`  no data for ${year}-${monthStr}`);
      continue;
    }
    if (!response.ok) {
      throw new Error(`Export failed for ${year}-${monthStr}: HTTP ${response.status} ${await response.text()}`);
    }

    await pipeline(Readable.fromWeb(response.body), createWriteStream(outFile));
    console.log(`  saved ${outFile}`);
  }
}

/** Walk every downloaded archive, tally daily LOAD/QUERY counts, and emit the seed SQL. */
function generateRollupSeed() {
  const dailyCounts = new Map(); // 'yyyy-MM-dd' -> { load: number, query: number }
  const zipFiles = readdirSync(outDir).filter((file) => file.endsWith('.zip'));
  if (!zipFiles.length) {
    console.error(`No .zip archives found in ${outDir} - run the download step first`);
    process.exit(1);
  }

  for (const zipFile of zipFiles) {
    console.log(`Processing ${zipFile}...`);
    const extractDir = join(outDir, zipFile.replace(/\.zip$/, ''));
    if (!existsSync(extractDir)) {
      execFileSync('unzip', ['-o', '-q', join(outDir, zipFile), '-d', extractDir]);
    }
    for (const dir of [extractDir, ...readdirSync(extractDir).map((entry) => join(extractDir, entry))]) {
      let entries;
      try {
        entries = readdirSync(dir).filter((entry) => entry.endsWith('.gz'));
      } catch {
        continue; // not a directory
      }
      for (const gzFile of entries) {
        const lines = gunzipSync(readFileSync(join(dir, gzFile)))
          .toString('utf8')
          .split('\n');
        for (const line of lines) {
          if (!line.trim()) {
            continue;
          }
          const event = JSON.parse(line);
          if (event.event_type !== LOAD_EVENT && event.event_type !== QUERY_EVENT) {
            continue;
          }
          const date = String(event.event_time || event.server_upload_time).slice(0, 10);
          const counts = dailyCounts.get(date) || { load: 0, query: 0 };
          if (event.event_type === LOAD_EVENT) {
            counts.load += Number(event.event_properties?.numRecords) || 0;
          } else {
            counts.query += 1;
          }
          dailyCounts.set(date, counts);
        }
      }
    }
  }

  const statements = [...dailyCounts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .flatMap(([date, { load, query }]) => [
      `INSERT INTO analytics_event_rollup (date, type, count) VALUES ('${date}', 'LOAD', ${load}) ON CONFLICT (date, type) DO UPDATE SET count = EXCLUDED.count;`,
      `INSERT INTO analytics_event_rollup (date, type, count) VALUES ('${date}', 'QUERY', ${query}) ON CONFLICT (date, type) DO UPDATE SET count = EXCLUDED.count;`,
    ]);

  const seedFile = join(outDir, 'analytics-rollup-seed.sql');
  writeFileSync(seedFile, `${statements.join('\n')}\n`);
  console.log(`Wrote ${dailyCounts.size} day(s) of rollup data to ${seedFile}`);
  console.log('NOTE: verify the table/column names against the AnalyticsEventRollup migration before running with psql.');
}

if (rollupOnly) {
  generateRollupSeed();
} else {
  await downloadArchives();
  console.log('Download complete. Re-run with --rollup to generate the AnalyticsEventRollup seed SQL.');
}
