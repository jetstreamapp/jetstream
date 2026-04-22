import type { Pool } from 'pg';
import { ENV } from '../config/env-config';
import { logger } from '../config/logger.config';
import { FirewallEventGroupRow, getConfiguredZoneIds, queryFirewallEventGroupsByDimensions } from './cloudflare.utils';

const HOUR_MS = 60 * 60 * 1000;
const DEFAULT_MAX_BACKFILL_HOURS = 48;
const DEFAULT_RETENTION_DAYS = 90;
const CLOUDFLARE_MAX_ROW_LIMIT = 1000;
const UPSERT_BATCH_SIZE = 200;
const COLUMN_COUNT = 12;

export interface ArchiverResult {
  windowStart: Date;
  windowEnd: Date;
  hoursProcessed: number;
  zonesProcessed: number;
  rowsUpserted: number;
  rowsDeleted: number;
  truncatedHours: Array<{ zoneId: string; hourStart: Date; rowCount: number }>;
}

interface ZoneHourFetcher {
  (zoneId: string, hourStart: Date, hourEnd: Date, limit: number): Promise<FirewallEventGroupRow[]>;
}

export interface ArchiverOptions {
  now?: Date;
  maxBackfillHours?: number;
  rowLimit?: number;
  /** Days of history to retain. `0` disables the sweep. */
  retentionDays?: number;
  /** Override the Cloudflare fetcher for tests. */
  fetchHour?: ZoneHourFetcher;
}

export function getRowLimit(): number {
  const raw = ENV.CLOUDFLARE_ANALYTICS_ROW_LIMIT;
  if (!raw) {
    return CLOUDFLARE_MAX_ROW_LIMIT;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return CLOUDFLARE_MAX_ROW_LIMIT;
  }
  return Math.min(Math.floor(parsed), CLOUDFLARE_MAX_ROW_LIMIT);
}

export function getMaxBackfillHours(): number {
  const raw = ENV.CLOUDFLARE_ANALYTICS_MAX_BACKFILL_HOURS;
  if (!raw) {
    return DEFAULT_MAX_BACKFILL_HOURS;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_MAX_BACKFILL_HOURS;
  }
  return Math.floor(parsed);
}

/**
 * Returns the retention window in days, or `0` to disable the sweep.
 * `0` is honored explicitly so operators can turn off deletion without code changes;
 * negative or non-numeric values fall back to the default.
 */
export function getRetentionDays(): number {
  const raw = ENV.CLOUDFLARE_ANALYTICS_RETENTION_DAYS;
  if (raw === undefined || raw === '') {
    return DEFAULT_RETENTION_DAYS;
  }
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return DEFAULT_RETENTION_DAYS;
  }
  return Math.floor(parsed);
}

export function floorToHour(date: Date): Date {
  const out = new Date(date);
  out.setUTCMinutes(0, 0, 0);
  return out;
}

/**
 * Returns hour-bucket starts in [windowStart, windowEnd).
 * Both inputs MUST already be hour-aligned UTC.
 */
export function listHourBuckets(windowStart: Date, windowEnd: Date): Date[] {
  if (windowEnd.getTime() <= windowStart.getTime()) {
    return [];
  }
  const buckets: Date[] = [];
  for (let cursor = windowStart.getTime(); cursor < windowEnd.getTime(); cursor += HOUR_MS) {
    buckets.push(new Date(cursor));
  }
  return buckets;
}

/**
 * Decide which window this run should process.
 *
 * - The window always ends at the most recently *completed* hour (`now` floored to
 *   the hour). Cloudflare data for the in-progress hour is incomplete and changes
 *   under us, so we never include it.
 * - If a previous successful run already covered through `windowEnd`, we return
 *   an empty window so the runner short-circuits — closed-hour data is stable, so
 *   re-fetching the same hour every run is pure waste against Cloudflare's API.
 * - Otherwise we resume from the previous run's `window_end` (self-healing after
 *   downtime), or fall back to a single-hour window on first run.
 * - The total window is capped by `maxBackfillHours` so a long outage doesn't
 *   produce a multi-day catch-up that hammers Cloudflare's API and risks falling
 *   off the GraphQL retention edge.
 */
export function planWindow(
  now: Date,
  lastWindowEnd: Date | null,
  maxBackfillHours: number,
): { windowStart: Date; windowEnd: Date; truncated: boolean } {
  const windowEnd = floorToHour(now);
  if (lastWindowEnd && lastWindowEnd.getTime() >= windowEnd.getTime()) {
    return { windowStart: windowEnd, windowEnd, truncated: false };
  }
  const defaultStart = new Date(windowEnd.getTime() - HOUR_MS);
  const requestedStart = lastWindowEnd ?? defaultStart;
  const earliestAllowed = new Date(windowEnd.getTime() - maxBackfillHours * HOUR_MS);
  const truncated = requestedStart.getTime() < earliestAllowed.getTime();
  const windowStart = truncated ? earliestAllowed : requestedStart;
  return { windowStart, windowEnd, truncated };
}

export async function getLatestSuccessfulWindowEnd(pool: Pool): Promise<Date | null> {
  const result = await pool.query<{ window_end: Date }>(
    `SELECT window_end FROM cron_run WHERE status = 'success' ORDER BY window_end DESC LIMIT 1`,
  );
  return result.rows[0]?.window_end ?? null;
}

async function startCronRun(pool: Pool, windowStart: Date, windowEnd: Date): Promise<number> {
  const result = await pool.query<{ id: number }>(
    `INSERT INTO cron_run (window_start, window_end, status) VALUES ($1, $2, 'running') RETURNING id`,
    [windowStart, windowEnd],
  );
  return result.rows[0].id;
}

async function completeCronRun(
  pool: Pool,
  id: number,
  status: 'success' | 'failed',
  details: {
    zonesProcessed: number;
    hoursProcessed: number;
    rowsUpserted: number;
    rowsDeleted: number;
    error?: string | null;
  },
): Promise<void> {
  await pool.query(
    `UPDATE cron_run
       SET completed_at = now(),
           status = $2,
           zones_processed = $3,
           hours_processed = $4,
           rows_upserted = $5,
           rows_deleted = $6,
           error = $7
     WHERE id = $1`,
    [
      id,
      status,
      details.zonesProcessed,
      details.hoursProcessed,
      details.rowsUpserted,
      details.rowsDeleted,
      details.error ?? null,
    ],
  );
}

/**
 * Sweeps `firewall_event_hourly` rows older than the retention window. Best-effort:
 * called after a successful upsert pass, so a transient delete failure shouldn't
 * fail the whole run (the upsert work is already persisted, and the next run will
 * try the sweep again). Returns the number of rows actually deleted, or `0` if
 * retention is disabled or the delete failed.
 */
export async function deleteOldFirewallEvents(pool: Pool, retentionDays: number): Promise<number> {
  if (retentionDays <= 0) {
    return 0;
  }
  try {
    const result = await pool.query(
      `DELETE FROM firewall_event_hourly WHERE hour_bucket < (now() - ($1 || ' days')::interval)`,
      [retentionDays.toString()],
    );
    return result.rowCount ?? 0;
  } catch (error) {
    logger.error(
      { err: error instanceof Error ? error.message : String(error), retentionDays },
      'Retention sweep failed — skipping (will retry next run)',
    );
    return 0;
  }
}

/**
 * Bulk upsert in chunks of UPSERT_BATCH_SIZE. The unique constraint covers every
 * Cloudflare grouping dimension (NULLS NOT DISTINCT), so two rows from the same
 * GraphQL response can never collide within a single batch. Conflicts only happen
 * across runs (re-processing the same hour after a crash or backfill); since
 * closed-hour data is stable, the only fields that need to move on conflict are
 * `count` and `updated_at`.
 */
export async function upsertFirewallEvents(
  pool: Pool,
  zoneId: string,
  rows: FirewallEventGroupRow[],
): Promise<number> {
  if (rows.length === 0) {
    return 0;
  }
  let total = 0;
  for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
    const batch = rows.slice(i, i + UPSERT_BATCH_SIZE);
    total += await upsertBatch(pool, zoneId, batch);
  }
  return total;
}

async function upsertBatch(pool: Pool, zoneId: string, batch: FirewallEventGroupRow[]): Promise<number> {
  const values: unknown[] = [];
  const placeholders: string[] = [];
  batch.forEach((row, rowIndex) => {
    const offset = rowIndex * COLUMN_COUNT;
    placeholders.push(
      `($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, ` +
        `$${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10}, $${offset + 11}, $${offset + 12})`,
    );
    values.push(
      zoneId,
      row.hourBucket,
      row.ruleId,
      row.ruleSource,
      row.action,
      row.clientIp,
      row.clientAsn,
      row.clientAsnDescription,
      row.clientCountry,
      row.httpHost,
      row.requestPath,
      row.count,
    );
  });

  const sql = `
    INSERT INTO firewall_event_hourly (
      zone_id, hour_bucket, rule_id, rule_source, action,
      client_ip, client_asn, client_asn_description, client_country,
      http_host, request_path, count
    )
    VALUES ${placeholders.join(', ')}
    ON CONFLICT ON CONSTRAINT firewall_event_hourly_dimensions_uq
    DO UPDATE SET
      count      = EXCLUDED.count,
      updated_at = now()
  `;

  const result = await pool.query(sql, values);
  return result.rowCount ?? batch.length;
}

export async function archiveCloudflareAnalytics(pool: Pool, options: ArchiverOptions = {}): Promise<ArchiverResult> {
  const now = options.now ?? new Date();
  const maxBackfillHours = options.maxBackfillHours ?? getMaxBackfillHours();
  const rowLimit = options.rowLimit ?? getRowLimit();
  const retentionDays = options.retentionDays ?? getRetentionDays();
  const fetchHour = options.fetchHour ?? queryFirewallEventGroupsByDimensions;

  const zoneIds = getConfiguredZoneIds();
  const lastWindowEnd = await getLatestSuccessfulWindowEnd(pool);
  const { windowStart, windowEnd, truncated } = planWindow(now, lastWindowEnd, maxBackfillHours);

  if (windowEnd.getTime() <= windowStart.getTime()) {
    logger.info(
      { windowStart: windowStart.toISOString(), windowEnd: windowEnd.toISOString() },
      'No new hours to process — skipping run',
    );
    return {
      windowStart,
      windowEnd,
      hoursProcessed: 0,
      zonesProcessed: 0,
      rowsUpserted: 0,
      rowsDeleted: 0,
      truncatedHours: [],
    };
  }

  const hourBuckets = listHourBuckets(windowStart, windowEnd);

  logger.info(
    {
      zones: zoneIds.length,
      hours: hourBuckets.length,
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      backfillTruncated: truncated,
      lastWindowEnd: lastWindowEnd?.toISOString() ?? null,
      retentionDays,
    },
    'Starting Cloudflare analytics archiver',
  );

  const runId = await startCronRun(pool, windowStart, windowEnd);
  const truncatedHours: ArchiverResult['truncatedHours'] = [];
  // Tracks distinct zones that completed at least one hour. Honest count for both
  // success and partial-failure paths — `zoneIds.length` would overstate on failure.
  const successfullyProcessedZones = new Set<string>();
  let rowsUpserted = 0;
  let rowsDeleted = 0;
  let hoursProcessed = 0;

  try {
    for (const hourStart of hourBuckets) {
      const hourEnd = new Date(hourStart.getTime() + HOUR_MS);
      for (const zoneId of zoneIds) {
        const rows = await fetchHour(zoneId, hourStart, hourEnd, rowLimit);
        if (rows.length >= rowLimit) {
          // Hitting the cap means we have at least `rowLimit` distinct dimension combinations
          // for this hour. The long tail beyond that is dropped — record it so we can spot
          // chronic truncation in cron_run logs and consider chunking by sub-hour later.
          truncatedHours.push({ zoneId, hourStart, rowCount: rows.length });
          logger.warn(
            { zoneId, hourStart: hourStart.toISOString(), rowCount: rows.length, rowLimit },
            'Hit row limit for hour — long tail of dimensions dropped',
          );
        }
        const upserted = await upsertFirewallEvents(pool, zoneId, rows);
        rowsUpserted += upserted;
        successfullyProcessedZones.add(zoneId);
        logger.debug(
          { zoneId, hourStart: hourStart.toISOString(), rows: rows.length, upserted },
          'Processed zone-hour',
        );
      }
      hoursProcessed += 1;
    }

    rowsDeleted = await deleteOldFirewallEvents(pool, retentionDays);

    await completeCronRun(pool, runId, 'success', {
      zonesProcessed: successfullyProcessedZones.size,
      hoursProcessed,
      rowsUpserted,
      rowsDeleted,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await completeCronRun(pool, runId, 'failed', {
      zonesProcessed: successfullyProcessedZones.size,
      hoursProcessed,
      rowsUpserted,
      rowsDeleted,
      error: message,
    }).catch((updateError) => {
      logger.error(
        { err: updateError instanceof Error ? updateError.message : String(updateError) },
        'Failed to mark cron_run as failed',
      );
    });
    throw error;
  }

  logger.info(
    {
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
      hoursProcessed,
      rowsUpserted,
      rowsDeleted,
      truncatedHourCount: truncatedHours.length,
    },
    'Cloudflare analytics archiver finished',
  );

  return {
    windowStart,
    windowEnd,
    hoursProcessed,
    zonesProcessed: successfullyProcessedZones.size,
    rowsUpserted,
    rowsDeleted,
    truncatedHours,
  };
}
