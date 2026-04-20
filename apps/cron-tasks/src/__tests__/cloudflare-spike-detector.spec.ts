import { sendCloudflareSecurityAlertEmail } from '@jetstream/email';
import type { PrismaClient } from '@jetstream/prisma';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { detectFirewallSpike } from '../utils/cloudflare-spike-detector.utils';
import { queryHourlyBlockCounts, queryTopDimension, queryTopRules, queryTotalsByAction } from '../utils/cloudflare.utils';

// Fixed "now" for every test so `new Date()` inside the SUT agrees with the test's expectations.
// Chose a time well clear of any hour boundary so fake-timer rounding has no surprises.
const FIXED_NOW = new Date('2026-01-15T14:30:00Z');

vi.mock('../config/env-config', () => ({
  ENV: {
    CLOUDFLARE_API_TOKEN: 'test-token',
    CLOUDFLARE_ZONE_IDS: 'zone-abc',
    CLOUDFLARE_ALERT_RECIPIENT: 'alerts@example.com',
    CLOUDFLARE_SPIKE_THRESHOLD_STDEV: '3',
    CLOUDFLARE_SPIKE_MIN_EVENTS: '50',
    CLOUDFLARE_SPIKE_COOLDOWN_MINUTES: '120',
    ADMIN_NOTIFICATION_EMAIL: 'admin@example.com',
  },
}));

vi.mock('@jetstream/email', () => ({
  CLOUDFLARE_SPIKE_SUBJECT_FRAGMENT: 'WAF spike detected',
  sendCloudflareSecurityAlertEmail: vi.fn(),
}));

vi.mock('../utils/cloudflare.utils', () => ({
  BLOCKED_ACTIONS: ['block', 'managed_challenge', 'jschallenge', 'challenge'],
  getConfiguredZoneIds: vi.fn(() => ['zone-abc']),
  queryHourlyBlockCounts: vi.fn(),
  queryTotalsByAction: vi.fn(),
  queryTopRules: vi.fn(),
  queryTopDimension: vi.fn(),
  // The SUT also imports these shared helpers from cloudflare.utils; keep them as real
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
  sortAndLimit: <T extends { count: number }>(rows: T[], limit: number) => [...rows].sort((a, b) => b.count - a.count).slice(0, limit),
}));

vi.mock('../utils/geo-ip.utils', () => ({
  lookupIpAddresses: vi.fn(async () => new Map()),
  formatLocation: vi.fn(() => ''),
}));

type MockFn = ReturnType<typeof vi.fn>;

const mockSendEmail = sendCloudflareSecurityAlertEmail as unknown as MockFn;
const mockQueryHourly = queryHourlyBlockCounts as unknown as MockFn;
const mockQueryTotals = queryTotalsByAction as unknown as MockFn;
const mockQueryTopRules = queryTopRules as unknown as MockFn;
const mockQueryTopDimension = queryTopDimension as unknown as MockFn;

/**
 * Produces the hour-truncated ISO string format Cloudflare's GraphQL API actually returns
 * (e.g. `2026-04-12T14:00:00Z`, no milliseconds). Using `.toISOString()` directly would
 * emit `...00.000Z` which masked a production-only bug in the spike detector — tests now
 * use this helper so a regression to string-based bucket comparison would fail here.
 */
function toCloudflareHour(date: Date): string {
  return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function buildBaselineRows(currentHourStart: Date, baselineCounts: number[]) {
  const rows: Array<{ datetimeHour: string; action: string; count: number }> = [];
  for (let i = 0; i < baselineCounts.length; i++) {
    const hour = new Date(currentHourStart.getTime() - (i + 1) * 60 * 60 * 1000);
    rows.push({ datetimeHour: toCloudflareHour(hour), action: 'block', count: baselineCounts[i] });
  }
  return rows;
}

function buildCurrentHourRows(currentHourStart: Date, currentCount: number) {
  return [{ datetimeHour: toCloudflareHour(currentHourStart), action: 'block', count: currentCount }];
}

/**
 * Sets up the mock for queryHourlyBlockCounts to return baseline rows on the first call
 * and current-hour rows on the second call, matching the two-query split in the SUT.
 */
function mockHourlyCounts({
  currentHourStart,
  currentCount,
  baselineCounts,
}: {
  currentHourStart: Date;
  currentCount: number;
  baselineCounts: number[];
}) {
  mockQueryHourly
    .mockResolvedValueOnce(buildBaselineRows(currentHourStart, baselineCounts))
    .mockResolvedValueOnce(buildCurrentHourRows(currentHourStart, currentCount));
}

// Matches the SUT's `currentHourEnd = floorToHour(now); currentHourStart = currentHourEnd - 1h`.
// With fake timers pinned to FIXED_NOW (14:30 UTC), this is 13:00 UTC.
function getCurrentHourStart(): Date {
  const currentHourEnd = new Date(FIXED_NOW);
  currentHourEnd.setUTCMinutes(0, 0, 0);
  return new Date(currentHourEnd.getTime() - 60 * 60 * 1000);
}

function buildPrismaMock(options: { recentSpikeEmail?: { id: number; createdAt: Date; subject: string } | null } = {}) {
  return {
    emailActivity: {
      findFirst: vi.fn().mockResolvedValue(options.recentSpikeEmail ?? null),
    },
  } as unknown as PrismaClient;
}

describe('detectFirewallSpike', () => {
  beforeEach(() => {
    // Pin system time so the SUT's `new Date()` and the test's expected `currentHourStart`
    // can't disagree across an hour boundary — previous implementation was flaky at XX:59:5x.
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_NOW);
    vi.clearAllMocks();
    mockQueryTotals.mockResolvedValue([
      { action: 'block', count: 900 },
      { action: 'managed_challenge', count: 200 },
    ]);
    mockQueryTopRules.mockResolvedValue([]);
    mockQueryTopDimension.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('does not alert when the current hour count is within the baseline envelope', async () => {
    const currentHourStart = getCurrentHourStart();
    // Baseline mean ~100, stdev ~10 → threshold ~130. Current = 110 → no spike.
    const baseline = Array.from({ length: 24 }, (_, i) => 100 + (i % 5) * 2);
    mockHourlyCounts({ currentHourStart, currentCount: 110, baselineCounts: baseline });

    const prisma = buildPrismaMock();
    const result = await detectFirewallSpike(prisma);

    expect(result).toEqual({ zonesChecked: 1, spikesDetected: 0, emailSent: false, cooldownActive: false });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('does not alert when the count is below the minimum event floor even if statistically high', async () => {
    const currentHourStart = getCurrentHourStart();
    // Quiet baseline (mostly zero, a couple of 1s), current = 10 → well above threshold
    // but below the 50-event floor.
    const baseline = [1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    mockHourlyCounts({ currentHourStart, currentCount: 10, baselineCounts: baseline });

    const prisma = buildPrismaMock();
    const result = await detectFirewallSpike(prisma);

    expect(result.spikesDetected).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('alerts a previously quiet zone when a real spike arrives (no observed baseline events)', async () => {
    // Cloudflare's grouped analytics omits hour buckets with zero events, so a quiet zone
    // returns no baseline rows at all. The spike detector must treat those hours as zero
    // (not "missing history") so it still fires when the current hour crosses the min-event
    // floor. Before this fix, such zones were skipped entirely.
    const currentHourStart = getCurrentHourStart();
    mockHourlyCounts({ currentHourStart, currentCount: 500, baselineCounts: [] });

    const prisma = buildPrismaMock();
    const result = await detectFirewallSpike(prisma);

    expect(result.spikesDetected).toBe(1);
    expect(result.emailSent).toBe(true);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    const emailCall = mockSendEmail.mock.calls[0][0];
    expect(emailCall.spikeInfo.currentCount).toBe(500);
    expect(emailCall.spikeInfo.baselineMean).toBe(0);
  });

  it('alerts when a true spike is detected', async () => {
    const currentHourStart = getCurrentHourStart();
    const baseline = Array.from({ length: 24 }, () => 50);
    mockHourlyCounts({ currentHourStart, currentCount: 5000, baselineCounts: baseline });

    const prisma = buildPrismaMock();
    const result = await detectFirewallSpike(prisma);

    expect(result.spikesDetected).toBe(1);
    expect(result.emailSent).toBe(true);
    expect(result.cooldownActive).toBe(false);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);

    const emailCall = mockSendEmail.mock.calls[0][0];
    expect(emailCall.to).toBe('alerts@example.com');
    expect(emailCall.mode).toBe('spike');
    expect(emailCall.spikeInfo.currentCount).toBe(5000);
    expect(emailCall.totals.blocked).toBe(900);
    expect(emailCall.totals.managed).toBe(200);
  });

  it('suppresses the email when the cooldown window is active', async () => {
    const currentHourStart = getCurrentHourStart();
    const baseline = Array.from({ length: 24 }, () => 50);
    mockHourlyCounts({ currentHourStart, currentCount: 5000, baselineCounts: baseline });

    const prisma = buildPrismaMock({
      recentSpikeEmail: {
        id: 1,
        createdAt: new Date(Date.now() - 30 * 60 * 1000), // 30 min ago, inside 120 min cooldown
        subject: '⚠ Jetstream Security Alert — WAF spike detected (earlier)',
      },
    });

    const result = await detectFirewallSpike(prisma);

    expect(result).toEqual({ zonesChecked: 1, spikesDetected: 1, emailSent: false, cooldownActive: true });
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('fails the run when any zone evaluation throws', async () => {
    mockQueryHourly.mockRejectedValue(new Error('cloudflare boom'));

    const prisma = buildPrismaMock();
    await expect(detectFirewallSpike(prisma)).rejects.toThrow(
      /Cloudflare spike detection aborted due to zone evaluation failures: zone-abc: cloudflare boom/,
    );
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
