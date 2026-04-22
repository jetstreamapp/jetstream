-- Schema for the Cloudflare analytics archive database.
--
-- This file is the source of truth for the standalone Postgres database that
-- backs the cloudflare-analytics-archiver cron entrypoint. Apply by hand
-- (idempotent — safe to re-run after every change here):
--
--   psql "$CLOUDFLARE_ANALYTICS_DBURI" -f apps/cron-tasks/db/cloudflare-analytics-schema.sql
--
-- Requires Postgres 15+ (uses NULLS NOT DISTINCT in the unique constraint).

CREATE TABLE IF NOT EXISTS firewall_event_hourly (
  id                     bigserial PRIMARY KEY,
  zone_id                text        NOT NULL,
  hour_bucket            timestamptz NOT NULL,
  rule_id                text,
  rule_source            text,
  action                 text        NOT NULL,
  client_ip              inet,
  client_asn             integer,
  client_asn_description text,
  client_country         text,
  http_host              text        NOT NULL DEFAULT '',
  request_path           text        NOT NULL DEFAULT '',
  count                  integer     NOT NULL,
  inserted_at            timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint mirrors Cloudflare's full grouping: every dimension that the
-- archiver reads becomes part of the key. This is required for correctness — if
-- two Cloudflare groups differ only in a non-key column (e.g. rule-less events
-- with different `source` values like 'bic' vs 'uaBlock'), they would target the
-- same conflict row in a single batch INSERT and Postgres would abort with
-- "ON CONFLICT DO UPDATE command cannot affect row a second time".
--
-- Drop-and-recreate is used so re-applying this file safely migrates installs
-- that have an earlier (narrower) version of the constraint. The rebuild is fast
-- on the expected row volume.
ALTER TABLE firewall_event_hourly
  DROP CONSTRAINT IF EXISTS firewall_event_hourly_dimensions_uq;
ALTER TABLE firewall_event_hourly
  ADD CONSTRAINT firewall_event_hourly_dimensions_uq UNIQUE NULLS NOT DISTINCT
    (zone_id, hour_bucket, rule_id, rule_source, action, client_ip, client_asn,
     client_asn_description, client_country, http_host, request_path);

CREATE INDEX IF NOT EXISTS firewall_event_hourly_hour_bucket_idx
  ON firewall_event_hourly (hour_bucket DESC);

CREATE INDEX IF NOT EXISTS firewall_event_hourly_rule_id_hour_idx
  ON firewall_event_hourly (rule_id, hour_bucket DESC);

CREATE INDEX IF NOT EXISTS firewall_event_hourly_client_ip_hour_idx
  ON firewall_event_hourly (client_ip, hour_bucket DESC);

CREATE INDEX IF NOT EXISTS firewall_event_hourly_request_path_hour_idx
  ON firewall_event_hourly (request_path, hour_bucket DESC);

CREATE INDEX IF NOT EXISTS firewall_event_hourly_zone_hour_idx
  ON firewall_event_hourly (zone_id, hour_bucket DESC);

-- Run bookkeeping. The cron uses the most recent successful row's
-- window_end as the starting point of the next run, which gives us
-- automatic catch-up after downtime (capped by Cloudflare retention).
CREATE TABLE IF NOT EXISTS cron_run (
  id               bigserial   PRIMARY KEY,
  started_at       timestamptz NOT NULL DEFAULT now(),
  completed_at     timestamptz,
  window_start     timestamptz NOT NULL,
  window_end       timestamptz NOT NULL,
  zones_processed  integer     NOT NULL DEFAULT 0,
  hours_processed  integer     NOT NULL DEFAULT 0,
  rows_upserted    integer     NOT NULL DEFAULT 0,
  rows_deleted     integer     NOT NULL DEFAULT 0,
  status           text        NOT NULL,
  error            text
);

-- Migrate older installs that pre-date the rows_deleted column.
ALTER TABLE cron_run ADD COLUMN IF NOT EXISTS rows_deleted integer NOT NULL DEFAULT 0;

-- Backs `getLatestSuccessfulWindowEnd` — the cron's startup query that resumes
-- from the latest *processed hour* (window_end), not the latest *completion time*.
-- These usually coincide in normal forward motion, but a manual backfill that
-- processes an older window later would diverge, and we want resume-from-latest-
-- processed-hour semantics either way.
CREATE INDEX IF NOT EXISTS cron_run_success_window_end_idx
  ON cron_run (window_end DESC) WHERE status = 'success';

-- Drop the prior (completed_at DESC) partial index — superseded by the
-- window_end index above. Safe no-op if the schema was never applied with it.
DROP INDEX IF EXISTS cron_run_completed_status_idx;
