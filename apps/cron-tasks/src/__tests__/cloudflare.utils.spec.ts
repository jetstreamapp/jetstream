import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  cloudflareGraphQL,
  getConfiguredZoneIds,
  queryHourlyBlockCounts,
  queryTopDimension,
  queryTopRules,
  queryTotalsByAction,
} from '../utils/cloudflare.utils';

vi.mock('../config/env-config', () => ({
  ENV: {
    CLOUDFLARE_API_TOKEN: 'test-token',
    CLOUDFLARE_ZONE_IDS: 'zone-abc,zone-def',
  },
}));

const originalFetch = global.fetch;

function mockFetchOnce(responseBody: unknown, init: { ok?: boolean; status?: number } = {}) {
  const ok = init.ok ?? true;
  const status = init.status ?? (ok ? 200 : 500);
  const fetchMock = vi.fn().mockResolvedValue({
    ok,
    status,
    json: async () => responseBody,
    text: async () => JSON.stringify(responseBody),
  });
  global.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe('cloudflare.utils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  describe('getConfiguredZoneIds', () => {
    it('parses a comma-separated list and trims entries', () => {
      expect(getConfiguredZoneIds()).toEqual(['zone-abc', 'zone-def']);
    });
  });

  describe('cloudflareGraphQL', () => {
    it('throws on a non-200 response', async () => {
      mockFetchOnce({ message: 'forbidden' }, { ok: false, status: 403 });
      await expect(cloudflareGraphQL('query X { a }', {})).rejects.toThrow(/status 403/);
    });

    it('throws when the response contains a top-level errors array', async () => {
      mockFetchOnce({ errors: [{ message: 'bad query' }] });
      await expect(cloudflareGraphQL('query X { a }', {})).rejects.toThrow(/bad query/);
    });

    it('throws when the response is missing data', async () => {
      mockFetchOnce({});
      await expect(cloudflareGraphQL('query X { a }', {})).rejects.toThrow(/missing data/);
    });

    it('returns the data on success', async () => {
      mockFetchOnce({ data: { viewer: { zones: [] } } });
      const result = await cloudflareGraphQL<{ viewer: { zones: unknown[] } }>('query X { a }', {});
      expect(result.viewer.zones).toEqual([]);
    });

    it('sends the API token as a Bearer auth header', async () => {
      const fetchMock = mockFetchOnce({ data: { viewer: { zones: [] } } });
      await cloudflareGraphQL('query X { a }', { foo: 'bar' });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [, init] = fetchMock.mock.calls[0];
      expect(init.headers.Authorization).toBe('Bearer test-token');
      const body = JSON.parse(init.body);
      expect(body.query).toContain('query X');
      expect(body.variables).toEqual({ foo: 'bar' });
    });
  });

  describe('queryHourlyBlockCounts', () => {
    it('maps the grouped response into flat rows', async () => {
      mockFetchOnce({
        data: {
          viewer: {
            zones: [
              {
                firewallEventsAdaptiveGroups: [
                  { count: 10, dimensions: { datetimeHour: '2026-04-12T14:00:00Z', action: 'block' } },
                  { count: 2, dimensions: { datetimeHour: '2026-04-12T14:00:00Z', action: 'managed_challenge' } },
                ],
              },
            ],
          },
        },
      });

      const rows = await queryHourlyBlockCounts('zone-abc', new Date('2026-04-12T13:00:00Z'), new Date('2026-04-12T15:00:00Z'));
      expect(rows).toHaveLength(2);
      expect(rows[0]).toEqual({ datetimeHour: '2026-04-12T14:00:00Z', action: 'block', count: 10 });
    });

    it('returns an empty array when the zone has no groups', async () => {
      mockFetchOnce({ data: { viewer: { zones: [{ firewallEventsAdaptiveGroups: [] }] } } });
      const rows = await queryHourlyBlockCounts('zone-abc', new Date(), new Date());
      expect(rows).toEqual([]);
    });
  });

  describe('queryTotalsByAction / queryTopRules / queryTopDimension', () => {
    it('parses totals by action', async () => {
      mockFetchOnce({
        data: {
          viewer: {
            zones: [
              {
                firewallEventsAdaptiveGroups: [
                  { count: 500, dimensions: { action: 'block' } },
                  { count: 100, dimensions: { action: 'managed_challenge' } },
                ],
              },
            ],
          },
        },
      });
      const rows = await queryTotalsByAction('zone-abc', new Date(), new Date());
      expect(rows).toEqual([
        { action: 'block', count: 500 },
        { action: 'managed_challenge', count: 100 },
      ]);
    });

    it('parses top rules and normalizes nulls', async () => {
      mockFetchOnce({
        data: {
          viewer: {
            zones: [
              {
                firewallEventsAdaptiveGroups: [
                  { count: 300, dimensions: { action: 'block', ruleId: 'rule-1', source: 'firewallManaged' } },
                  { count: 50, dimensions: { action: 'managed_challenge', ruleId: '', source: '' } },
                ],
              },
            ],
          },
        },
      });
      const rows = await queryTopRules('zone-abc', new Date(), new Date(), 10);
      expect(rows).toEqual([
        { action: 'block', ruleId: 'rule-1', source: 'firewallManaged', count: 300 },
        { action: 'managed_challenge', ruleId: null, source: null, count: 50 },
      ]);
    });

    it('parses top dimension rows by the requested dimension name', async () => {
      mockFetchOnce({
        data: {
          viewer: {
            zones: [
              {
                firewallEventsAdaptiveGroups: [
                  { count: 250, dimensions: { clientCountryName: 'RU' } },
                  { count: 120, dimensions: { clientCountryName: 'CN' } },
                ],
              },
            ],
          },
        },
      });
      const rows = await queryTopDimension('zone-abc', new Date(), new Date(), 'clientCountryName', 10);
      expect(rows).toEqual([
        { value: 'RU', count: 250 },
        { value: 'CN', count: 120 },
      ]);
    });
  });
});
