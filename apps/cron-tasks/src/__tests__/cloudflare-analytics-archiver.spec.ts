import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  archiveCloudflareAnalytics,
  deleteOldFirewallEvents,
  floorToHour,
  getMaxBackfillHours,
  getRetentionDays,
  getRowLimit,
  listHourBuckets,
  planWindow,
} from '../utils/cloudflare-analytics-archiver.utils';
import { FirewallEventGroupRow } from '../utils/cloudflare.utils';

vi.mock('../config/env-config', () => ({
  ENV: {
    CLOUDFLARE_API_TOKEN: 'test-token',
    CLOUDFLARE_ZONE_IDS: 'zone-abc,zone-def',
    CLOUDFLARE_ANALYTICS_MAX_BACKFILL_HOURS: undefined,
    CLOUDFLARE_ANALYTICS_ROW_LIMIT: undefined,
    CLOUDFLARE_ANALYTICS_RETENTION_DAYS: undefined,
  },
}));

describe('cloudflare-analytics-archiver.utils', () => {
  describe('floorToHour', () => {
    it('truncates minutes/seconds/ms to zero in UTC', () => {
      const out = floorToHour(new Date('2026-04-21T14:37:42.123Z'));
      expect(out.toISOString()).toBe('2026-04-21T14:00:00.000Z');
    });
  });

  describe('listHourBuckets', () => {
    it('returns one bucket per hour in [start, end)', () => {
      const start = new Date('2026-04-21T10:00:00.000Z');
      const end = new Date('2026-04-21T13:00:00.000Z');
      const buckets = listHourBuckets(start, end).map((d) => d.toISOString());
      expect(buckets).toEqual([
        '2026-04-21T10:00:00.000Z',
        '2026-04-21T11:00:00.000Z',
        '2026-04-21T12:00:00.000Z',
      ]);
    });

    it('returns an empty array when end <= start', () => {
      const t = new Date('2026-04-21T10:00:00.000Z');
      expect(listHourBuckets(t, t)).toEqual([]);
      expect(listHourBuckets(new Date(t.getTime() + 60_000), t)).toEqual([]);
    });
  });

  describe('planWindow', () => {
    const now = new Date('2026-04-21T14:37:00.000Z');

    it('uses the previous completed hour when there is no prior run', () => {
      const { windowStart, windowEnd, truncated } = planWindow(now, null, 48);
      expect(windowEnd.toISOString()).toBe('2026-04-21T14:00:00.000Z');
      expect(windowStart.toISOString()).toBe('2026-04-21T13:00:00.000Z');
      expect(truncated).toBe(false);
    });

    it('resumes from the prior run window_end', () => {
      const lastWindowEnd = new Date('2026-04-21T11:00:00.000Z');
      const { windowStart, windowEnd, truncated } = planWindow(now, lastWindowEnd, 48);
      expect(windowEnd.toISOString()).toBe('2026-04-21T14:00:00.000Z');
      expect(windowStart.toISOString()).toBe('2026-04-21T11:00:00.000Z');
      expect(truncated).toBe(false);
    });

    it('caps long catch-ups at maxBackfillHours', () => {
      const lastWindowEnd = new Date('2026-04-15T00:00:00.000Z');
      const { windowStart, windowEnd, truncated } = planWindow(now, lastWindowEnd, 48);
      expect(windowEnd.toISOString()).toBe('2026-04-21T14:00:00.000Z');
      // 48 hours back from 14:00 UTC on the 21st = 14:00 UTC on the 19th
      expect(windowStart.toISOString()).toBe('2026-04-19T14:00:00.000Z');
      expect(truncated).toBe(true);
    });

    it('produces an empty window when the prior run is already current', () => {
      const lastWindowEnd = new Date('2026-04-21T14:00:00.000Z');
      const { windowStart, windowEnd, truncated } = planWindow(now, lastWindowEnd, 48);
      // Both ends collapse to the same instant so the runner short-circuits — no API call,
      // no upsert, just record-keeping that there was nothing to do.
      expect(windowStart.toISOString()).toBe('2026-04-21T14:00:00.000Z');
      expect(windowEnd.toISOString()).toBe('2026-04-21T14:00:00.000Z');
      expect(truncated).toBe(false);
    });

    it('produces an empty window when the prior run is somehow ahead of now', () => {
      // Defensive: clock skew or manual cron_run inserts could land here.
      const lastWindowEnd = new Date('2026-04-21T15:00:00.000Z');
      const { windowStart, windowEnd } = planWindow(now, lastWindowEnd, 48);
      expect(windowStart.toISOString()).toBe('2026-04-21T14:00:00.000Z');
      expect(windowEnd.toISOString()).toBe('2026-04-21T14:00:00.000Z');
    });
  });

  describe('getRowLimit / getMaxBackfillHours / getRetentionDays', () => {
    it('returns the Cloudflare cap and retention default when env is unset', () => {
      expect(getRowLimit()).toBe(1000);
      expect(getMaxBackfillHours()).toBe(48);
      expect(getRetentionDays()).toBe(90);
    });
  });

  describe('archiveCloudflareAnalytics', () => {
    type QueryArgs = { text: string; values?: unknown[] };
    let queries: QueryArgs[];
    const queryFn = vi.fn();

    beforeEach(() => {
      queries = [];
      queryFn.mockReset();
      queryFn.mockImplementation(async (text: string, values?: unknown[]) => {
        queries.push({ text, values });
        if (text.includes('SELECT window_end')) {
          return { rows: [], rowCount: 0 };
        }
        if (text.includes('INSERT INTO cron_run')) {
          return { rows: [{ id: 42 }], rowCount: 1 };
        }
        if (text.includes('INSERT INTO firewall_event_hourly')) {
          const rowCount = (values?.length ?? 0) / 12;
          return { rows: [], rowCount };
        }
        if (text.includes('DELETE FROM firewall_event_hourly')) {
          return { rows: [], rowCount: 11 };
        }
        if (text.includes('UPDATE cron_run')) {
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      });
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    function fakePool() {
      return { query: queryFn } as unknown as Parameters<typeof archiveCloudflareAnalytics>[0];
    }

    it('processes each (zone, hour) pair, upserts rows, and records cron_run success', async () => {
      const fetched: Array<{ zone: string; hourStart: string }> = [];
      const fetchHour = vi.fn().mockImplementation(async (zoneId: string, hourStart: Date) => {
        fetched.push({ zone: zoneId, hourStart: hourStart.toISOString() });
        const row: FirewallEventGroupRow = {
          hourBucket: new Date(hourStart),
          ruleId: 'rule-1',
          ruleSource: 'firewallManaged',
          action: 'block',
          clientIp: '1.2.3.4',
          clientAsn: 64500,
          clientAsnDescription: 'TEST-ASN',
          clientCountry: 'US',
          httpHost: 'getjetstream.app',
          requestPath: '/api/login',
          count: 7,
        };
        return [row];
      });

      const result = await archiveCloudflareAnalytics(fakePool(), {
        now: new Date('2026-04-21T14:37:00.000Z'),
        fetchHour,
      });

      expect(result.hoursProcessed).toBe(1);
      expect(result.zonesProcessed).toBe(2);
      expect(result.rowsUpserted).toBe(2); // 2 zones × 1 row each
      expect(result.rowsDeleted).toBe(11); // mocked retention sweep returns 11
      expect(result.truncatedHours).toEqual([]);
      expect(fetched).toEqual([
        { zone: 'zone-abc', hourStart: '2026-04-21T13:00:00.000Z' },
        { zone: 'zone-def', hourStart: '2026-04-21T13:00:00.000Z' },
      ]);

      const deleteCall = queries.find((query) => query.text.includes('DELETE FROM firewall_event_hourly'));
      expect(deleteCall).toBeDefined();
      // pg query passes interval days as a string parameter to keep the cast simple
      expect(deleteCall?.values).toEqual(['90']);

      const updateCall = queries.find((query) => query.text.includes('UPDATE cron_run'));
      expect(updateCall).toBeDefined();
      // [id, status, zonesProcessed, hoursProcessed, rowsUpserted, rowsDeleted, error]
      expect(updateCall?.values).toEqual([42, 'success', 2, 1, 2, 11, null]);
    });

    it('skips the retention sweep when retentionDays is 0', async () => {
      const fetchHour = vi.fn().mockResolvedValue([]);

      const result = await archiveCloudflareAnalytics(fakePool(), {
        now: new Date('2026-04-21T14:37:00.000Z'),
        retentionDays: 0,
        fetchHour,
      });

      expect(result.rowsDeleted).toBe(0);
      const deleteCall = queries.find((query) => query.text.includes('DELETE FROM firewall_event_hourly'));
      expect(deleteCall).toBeUndefined();
    });

    it('still completes the run as success when the retention sweep fails', async () => {
      // Override only the DELETE branch to throw — everything else stays as the default mock.
      queryFn.mockImplementation(async (text: string, values?: unknown[]) => {
        queries.push({ text, values });
        if (text.includes('SELECT window_end')) {
          return { rows: [], rowCount: 0 };
        }
        if (text.includes('INSERT INTO cron_run')) {
          return { rows: [{ id: 42 }], rowCount: 1 };
        }
        if (text.includes('INSERT INTO firewall_event_hourly')) {
          return { rows: [], rowCount: (values?.length ?? 0) / 12 };
        }
        if (text.includes('DELETE FROM firewall_event_hourly')) {
          throw new Error('lock timeout');
        }
        if (text.includes('UPDATE cron_run')) {
          return { rows: [], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      });

      const fetchHour = vi.fn().mockResolvedValue([]);

      const result = await archiveCloudflareAnalytics(fakePool(), {
        now: new Date('2026-04-21T14:37:00.000Z'),
        fetchHour,
      });

      expect(result.rowsDeleted).toBe(0);
      const updateCall = queries.find((query) => query.text.includes('UPDATE cron_run'));
      expect(updateCall?.values?.[1]).toBe('success');
      expect(updateCall?.values?.[5]).toBe(0); // rows_deleted = 0 because the sweep failed
    });

    it('flags truncated hours when the row limit is hit', async () => {
      const rowLimit = 2;
      const truncatedRows: FirewallEventGroupRow[] = Array.from({ length: rowLimit }, (_, i) => ({
        hourBucket: new Date('2026-04-21T13:00:00.000Z'),
        ruleId: `rule-${i}`,
        ruleSource: 'firewallManaged',
        action: 'block',
        clientIp: `1.2.3.${i}`,
        clientAsn: null,
        clientAsnDescription: null,
        clientCountry: null,
        httpHost: 'h',
        requestPath: '/p',
        count: 1,
      }));
      const fetchHour = vi.fn().mockResolvedValue(truncatedRows);

      const result = await archiveCloudflareAnalytics(fakePool(), {
        now: new Date('2026-04-21T14:37:00.000Z'),
        rowLimit,
        fetchHour,
      });

      // Two zones × one hour, both truncated
      expect(result.truncatedHours).toHaveLength(2);
      expect(result.truncatedHours[0]).toMatchObject({ rowCount: rowLimit });
    });

    it('marks cron_run failed and rethrows when fetch fails', async () => {
      const fetchHour = vi.fn().mockRejectedValue(new Error('boom'));

      await expect(
        archiveCloudflareAnalytics(fakePool(), {
          now: new Date('2026-04-21T14:37:00.000Z'),
          fetchHour,
        }),
      ).rejects.toThrow('boom');

      const updateCall = queries.find((query) => query.text.includes('UPDATE cron_run'));
      expect(updateCall).toBeDefined();
      expect(updateCall?.values?.[1]).toBe('failed');
      // [id, status, zonesProcessed, hoursProcessed, rowsUpserted, rowsDeleted, error]
      expect(updateCall?.values?.[2]).toBe(0); // honest count: nothing succeeded before the throw
      expect(updateCall?.values?.[5]).toBe(0); // retention sweep never ran
      expect(updateCall?.values?.[6]).toBe('boom');
    });
  });

  describe('deleteOldFirewallEvents', () => {
    it('returns 0 without querying when retentionDays is 0', async () => {
      const queryFn = vi.fn();
      const pool = { query: queryFn } as unknown as Parameters<typeof deleteOldFirewallEvents>[0];
      const deleted = await deleteOldFirewallEvents(pool, 0);
      expect(deleted).toBe(0);
      expect(queryFn).not.toHaveBeenCalled();
    });

    it('returns 0 and swallows the error when the DELETE fails', async () => {
      const queryFn = vi.fn().mockRejectedValue(new Error('boom'));
      const pool = { query: queryFn } as unknown as Parameters<typeof deleteOldFirewallEvents>[0];
      const deleted = await deleteOldFirewallEvents(pool, 90);
      expect(deleted).toBe(0);
      expect(queryFn).toHaveBeenCalledOnce();
    });

    it('returns the rowCount on success', async () => {
      const queryFn = vi.fn().mockResolvedValue({ rowCount: 42 });
      const pool = { query: queryFn } as unknown as Parameters<typeof deleteOldFirewallEvents>[0];
      const deleted = await deleteOldFirewallEvents(pool, 30);
      expect(deleted).toBe(42);
      const [sql, values] = queryFn.mock.calls[0];
      expect(sql).toContain('DELETE FROM firewall_event_hourly');
      expect(values).toEqual(['30']);
    });
  });
});
