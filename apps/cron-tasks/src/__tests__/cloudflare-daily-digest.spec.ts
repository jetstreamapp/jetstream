import { sendCloudflareSecurityAlertEmail } from '@jetstream/email';
import type { PrismaClient } from '@jetstream/prisma';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getConfiguredZoneIds, queryTopDimension, queryTopRules, queryTotalsByAction } from '../utils/cloudflare.utils';
import { sendCloudflareDailyDigest } from '../utils/cloudflare-daily-digest.utils';

vi.mock('../config/env-config', () => ({
  ENV: {
    CLOUDFLARE_API_TOKEN: 'test-token',
    CLOUDFLARE_ZONE_IDS: 'zone-abc',
    CLOUDFLARE_ALERT_RECIPIENT: 'alerts@example.com',
    ADMIN_NOTIFICATION_EMAIL: 'admin@example.com',
  },
}));

vi.mock('@jetstream/email', () => ({
  sendCloudflareSecurityAlertEmail: vi.fn(),
}));

vi.mock('../utils/cloudflare.utils', () => ({
  BLOCKED_ACTIONS: ['block', 'managed_challenge', 'jschallenge', 'challenge'],
  getConfiguredZoneIds: vi.fn(() => ['zone-abc']),
  queryTotalsByAction: vi.fn(),
  queryTopRules: vi.fn(),
  queryTopDimension: vi.fn(),
  // The SUT imports these shared helpers from cloudflare.utils; keep them as real
  // implementations so the test exercises the actual aggregation path rather than a stub.
  aggregateActionTotals: (totals: Array<{ action: string; count: number }>) => {
    let blocked = 0;
    let challenged = 0;
    let managed = 0;
    for (const row of totals) {
      if (row.action === 'block') {
        blocked += row.count;
      } else if (row.action === 'managed_challenge') {
        managed += row.count;
      } else if (['block', 'managed_challenge', 'jschallenge', 'challenge'].includes(row.action)) {
        challenged += row.count;
      }
    }
    return { blocked, challenged, managed, total: blocked + challenged + managed };
  },
  sortAndLimit: <T extends { count: number }>(rows: T[], limit: number) =>
    [...rows].sort((a, b) => b.count - a.count).slice(0, limit),
}));

vi.mock('../utils/geo-ip.utils', () => ({
  lookupIpAddresses: vi.fn(async (ips: string[]) => {
    const map = new Map();
    for (const ip of ips) {
      map.set(ip, { city: 'City', country: 'Country', countryCode: 'CC', region: null, latitude: 1, longitude: 2 });
    }
    return map;
  }),
  formatLocation: vi.fn((geo) => (geo ? `${geo.city}, ${geo.countryCode}` : '')),
}));

type MockFn = ReturnType<typeof vi.fn>;

const mockSendEmail = sendCloudflareSecurityAlertEmail as unknown as MockFn;
const mockGetZones = getConfiguredZoneIds as unknown as MockFn;
const mockQueryTotals = queryTotalsByAction as unknown as MockFn;
const mockQueryTopRules = queryTopRules as unknown as MockFn;
const mockQueryTopDimension = queryTopDimension as unknown as MockFn;

const stubPrisma = {} as unknown as PrismaClient;

describe('sendCloudflareDailyDigest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetZones.mockImplementation(() => ['zone-abc']);
  });

  it('sends a digest with aggregated top-N data', async () => {
    mockQueryTotals.mockResolvedValue([
      { action: 'block', count: 1200 },
      { action: 'managed_challenge', count: 300 },
      { action: 'challenge', count: 50 },
    ]);
    mockQueryTopRules.mockResolvedValue([
      { action: 'block', ruleId: 'rule-1', source: 'firewallManaged', count: 400 },
      { action: 'block', ruleId: 'rule-2', source: 'firewallManaged', count: 250 },
    ]);
    mockQueryTopDimension.mockImplementation(async (_zone: string, _since: Date, _until: Date, dimension: string) => {
      if (dimension === 'clientIP') {
        return [
          { value: '1.2.3.4', count: 500 },
          { value: '5.6.7.8', count: 100 },
        ];
      }
      if (dimension === 'clientCountryName') {
        return [
          { value: 'RU', count: 700 },
          { value: 'CN', count: 300 },
        ];
      }
      if (dimension === 'clientRequestHTTPHost') {
        return [{ value: 'getjetstream.app', count: 1400 }];
      }
      if (dimension === 'clientRequestPath') {
        return [
          { value: '/login', count: 500 },
          { value: '/wp-admin.php', count: 250 },
        ];
      }
      return [];
    });

    const result = await sendCloudflareDailyDigest(stubPrisma);

    expect(result.totalEvents).toBe(1550);
    expect(result.zonesReported).toBe(1);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);

    const payload = mockSendEmail.mock.calls[0][0];
    expect(payload.mode).toBe('digest');
    expect(payload.to).toBe('alerts@example.com');
    expect(payload.totals).toEqual({ blocked: 1200, challenged: 50, managed: 300, total: 1550 });
    expect(payload.topRules[0].ruleId).toBe('rule-1');
    expect(payload.topIps[0].ip).toBe('1.2.3.4');
    expect(payload.topIps[0].location).toBe('City, CC');
    expect(payload.topCountries[0]).toEqual({ value: 'RU', count: 700 });
    expect(payload.topHosts[0].value).toBe('getjetstream.app');
    expect(payload.topPaths[0].value).toBe('/login');
  });

  it('sends an all-clear digest even when there are zero events', async () => {
    mockQueryTotals.mockResolvedValue([]);
    mockQueryTopRules.mockResolvedValue([]);
    mockQueryTopDimension.mockResolvedValue([]);

    const result = await sendCloudflareDailyDigest(stubPrisma);

    expect(result.totalEvents).toBe(0);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const payload = mockSendEmail.mock.calls[0][0];
    expect(payload.totals).toEqual({ blocked: 0, challenged: 0, managed: 0, total: 0 });
    expect(payload.topRules).toEqual([]);
  });

  it('throws when no zones are configured', async () => {
    mockGetZones.mockImplementationOnce(() => {
      throw new Error('CLOUDFLARE_ZONE_IDS is not configured');
    });

    await expect(sendCloudflareDailyDigest(stubPrisma)).rejects.toThrow(/CLOUDFLARE_ZONE_IDS/);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
