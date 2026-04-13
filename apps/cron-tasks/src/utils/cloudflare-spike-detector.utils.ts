import { CLOUDFLARE_SPIKE_SUBJECT_FRAGMENT, sendCloudflareSecurityAlertEmail } from '@jetstream/email';
import { PrismaClient } from '@jetstream/prisma';
import { ENV } from '../config/env-config';
import { logger } from '../config/logger.config';
import {
  ActionTotal,
  aggregateActionTotals,
  getConfiguredZoneIds,
  HourlyBlockCount,
  queryHourlyBlockCounts,
  queryTopDimension,
  queryTopRules,
  queryTotalsByAction,
  sortAndLimit,
  TopDimensionRow,
  TopRuleRow,
} from './cloudflare.utils';
import { formatLocation, GeoIpResult, lookupIpAddresses } from './geo-ip.utils';

const DEFAULT_THRESHOLD_STDEV = 3;
const DEFAULT_MIN_EVENTS = 50;
const DEFAULT_COOLDOWN_MINUTES = 120;

export interface SpikeDetectionResult {
  zonesChecked: number;
  spikesDetected: number;
  emailSent: boolean;
  cooldownActive: boolean;
}

interface FlaggedZone {
  zoneId: string;
  currentCount: number;
  baselineMean: number;
  baselineStdev: number;
  zScore: number;
  currentHourStart: Date;
  currentHourEnd: Date;
}

function getNumberEnv(value: string | undefined, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed) || parsed < 0) {
    return fallback;
  }
  return parsed;
}

function floorToHour(date: Date): Date {
  const floored = new Date(date);
  floored.setUTCMinutes(0, 0, 0);
  return floored;
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

/**
 * Buckets the raw hourly rows into a `hourStartMs -> totalCount` map. Keys use epoch ms so the
 * comparison is independent of the exact ISO string format Cloudflare returns — `datetimeHour`
 * comes back truncated to the hour (e.g. `2026-04-12T14:00:00Z`) while JS `.toISOString()`
 * always emits millisecond precision (`...00.000Z`), so a raw string key would never match.
 */
function sumHourly(rows: HourlyBlockCount[]): Map<number, number> {
  const totals = new Map<number, number>();
  for (const row of rows) {
    const hourMs = new Date(row.datetimeHour).getTime();
    if (Number.isNaN(hourMs)) {
      continue;
    }
    const existing = totals.get(hourMs) ?? 0;
    totals.set(hourMs, existing + row.count);
  }
  return totals;
}

function computeMeanStdev(values: number[]): { mean: number; stdev: number } {
  if (values.length === 0) {
    return { mean: 0, stdev: 0 };
  }
  const mean = values.reduce((acc, value) => acc + value, 0) / values.length;
  const variance = values.reduce((acc, value) => acc + (value - mean) ** 2, 0) / values.length;
  return { mean, stdev: Math.sqrt(variance) };
}

export async function detectFirewallSpike(prisma: PrismaClient): Promise<SpikeDetectionResult> {
  if (!ENV.CLOUDFLARE_API_TOKEN) {
    throw new Error('CLOUDFLARE_API_TOKEN is not configured');
  }

  const zoneIds = getConfiguredZoneIds();
  const recipient = ENV.CLOUDFLARE_ALERT_RECIPIENT || ENV.ADMIN_NOTIFICATION_EMAIL;
  if (!recipient) {
    throw new Error('CLOUDFLARE_ALERT_RECIPIENT or ADMIN_NOTIFICATION_EMAIL must be configured');
  }

  const thresholdStdev = getNumberEnv(ENV.CLOUDFLARE_SPIKE_THRESHOLD_STDEV, DEFAULT_THRESHOLD_STDEV);
  const minEvents = getNumberEnv(ENV.CLOUDFLARE_SPIKE_MIN_EVENTS, DEFAULT_MIN_EVENTS);
  const cooldownMinutes = getNumberEnv(ENV.CLOUDFLARE_SPIKE_COOLDOWN_MINUTES, DEFAULT_COOLDOWN_MINUTES);

  const now = new Date();
  // We look at "current hour" = the most recently COMPLETED hour.
  const currentHourEnd = floorToHour(now);
  const currentHourStart = addHours(currentHourEnd, -1);
  // Baseline window: the 24 hours before that. Query 25h back so we can separate the current hour from the baseline.
  const windowStart = addHours(currentHourEnd, -25);

  logger.info(
    {
      zones: zoneIds.length,
      windowStart: windowStart.toISOString(),
      currentHourStart: currentHourStart.toISOString(),
      currentHourEnd: currentHourEnd.toISOString(),
      thresholdStdev,
      minEvents,
    },
    'Starting Cloudflare firewall spike detection',
  );

  const flaggedZones: FlaggedZone[] = [];

  for (const zoneId of zoneIds) {
    try {
      const rows = await queryHourlyBlockCounts(zoneId, windowStart, currentHourEnd);
      const totalsByHour = sumHourly(rows);

      const currentHourMs = currentHourStart.getTime();
      const currentCount = totalsByHour.get(currentHourMs) ?? 0;

      // Baseline = 24 hours preceding the current hour. Iterate the expected hourly buckets
      // explicitly so quiet hours omitted from Cloudflare's grouped response are included as
      // zeros — otherwise a legitimately quiet zone that just saw a real spike would get skipped
      // because its baseline would look "empty" rather than "near zero". The `minEvents` floor
      // is the safety net for brand-new zones with no meaningful history.
      const baselineStartMs = currentHourMs - 24 * 60 * 60 * 1000;
      const baselineValues: number[] = [];
      let observedBaselineHours = 0;
      for (let hourMs = baselineStartMs; hourMs < currentHourMs; hourMs += 60 * 60 * 1000) {
        const count = totalsByHour.get(hourMs);
        if (count !== undefined) {
          observedBaselineHours++;
        }
        baselineValues.push(count ?? 0);
      }

      const { mean, stdev } = computeMeanStdev(baselineValues);
      const threshold = mean + thresholdStdev * stdev;
      const zScore = stdev > 0 ? (currentCount - mean) / stdev : 0;

      logger.info(
        {
          zoneId,
          currentCount,
          observedBaselineHours,
          baselineMean: Number(mean.toFixed(2)),
          baselineStdev: Number(stdev.toFixed(2)),
          threshold: Number(threshold.toFixed(2)),
          zScore: Number(zScore.toFixed(2)),
        },
        'Spike detection stats',
      );

      // Strict `>` is important when `stdev === 0` (perfectly flat baseline): in that case
      // threshold === mean, and `currentCount === mean` is "no change," not a spike.
      if (currentCount > threshold && currentCount >= minEvents) {
        flaggedZones.push({
          zoneId,
          currentCount,
          baselineMean: mean,
          baselineStdev: stdev,
          zScore,
          currentHourStart,
          currentHourEnd,
        });
      }
    } catch (error) {
      logger.error({ error, zoneId }, 'Failed to evaluate zone for spike detection');
    }
  }

  if (flaggedZones.length === 0) {
    return { zonesChecked: zoneIds.length, spikesDetected: 0, emailSent: false, cooldownActive: false };
  }

  // Cooldown check — look for a recent spike email row in email_activity.
  const cooldownStart = new Date(Date.now() - cooldownMinutes * 60 * 1000);
  const recentSpikeEmail = await prisma.emailActivity.findFirst({
    where: {
      subject: { contains: CLOUDFLARE_SPIKE_SUBJECT_FRAGMENT },
      createdAt: { gt: cooldownStart },
    },
    select: { id: true, createdAt: true, subject: true },
  });

  if (recentSpikeEmail) {
    logger.info(
      { spikesDetected: flaggedZones.length, recentEmailAt: recentSpikeEmail.createdAt, cooldownMinutes },
      'Spike detected but cooldown active — skipping email',
    );
    return {
      zonesChecked: zoneIds.length,
      spikesDetected: flaggedZones.length,
      emailSent: false,
      cooldownActive: true,
    };
  }

  // Gather alert payload from the flagged zones (current-hour window).
  const alertTotals: ActionTotal[] = [];
  const topRules: TopRuleRow[] = [];
  const topIpsRaw: TopDimensionRow[] = [];
  const topCountriesRaw: TopDimensionRow[] = [];
  const topHostsRaw: TopDimensionRow[] = [];
  const topPathsRaw: TopDimensionRow[] = [];

  for (const zone of flaggedZones) {
    try {
      const [totals, rules, ips, countries, hosts, paths] = await Promise.all([
        queryTotalsByAction(zone.zoneId, zone.currentHourStart, zone.currentHourEnd),
        queryTopRules(zone.zoneId, zone.currentHourStart, zone.currentHourEnd, 20),
        queryTopDimension(zone.zoneId, zone.currentHourStart, zone.currentHourEnd, 'clientIP', 15),
        queryTopDimension(zone.zoneId, zone.currentHourStart, zone.currentHourEnd, 'clientCountryName', 10),
        queryTopDimension(zone.zoneId, zone.currentHourStart, zone.currentHourEnd, 'clientRequestHTTPHost', 10),
        queryTopDimension(zone.zoneId, zone.currentHourStart, zone.currentHourEnd, 'clientRequestPath', 15),
      ]);
      alertTotals.push(...totals);
      topRules.push(...rules);
      topIpsRaw.push(...ips);
      topCountriesRaw.push(...countries);
      topHostsRaw.push(...hosts);
      topPathsRaw.push(...paths);
    } catch (error) {
      logger.error({ error, zoneId: zone.zoneId }, 'Failed to gather alert details for flagged zone');
    }
  }

  const topIpsWithValue = topIpsRaw.filter((row) => !!row.value);
  const ips = topIpsWithValue.map((row) => row.value);
  const geoMap: Map<string, GeoIpResult | null> = ips.length > 0 ? await lookupIpAddresses(ips) : new Map();

  const totalsAggregated = aggregateActionTotals(alertTotals);

  const worst = flaggedZones.reduce((acc, zone) => (zone.zScore > acc.zScore ? zone : acc), flaggedZones[0]);

  const windowLabel = formatHourWindow(worst.currentHourStart, worst.currentHourEnd);
  const generatedAt = now.toLocaleString('en-US', { timeZone: 'America/Denver', dateStyle: 'full', timeStyle: 'short' });

  await sendCloudflareSecurityAlertEmail({
    to: recipient,
    mode: 'spike',
    generatedAt,
    windowDescription: windowLabel,
    zones: flaggedZones.map((zone) => ({ zoneId: zone.zoneId, label: zone.zoneId })),
    totals: totalsAggregated,
    spikeInfo: {
      currentCount: worst.currentCount,
      baselineMean: worst.baselineMean,
      baselineStdev: worst.baselineStdev,
      zScore: worst.zScore,
      thresholdStdev,
      minEvents,
    },
    topRules: sortAndLimit(
      topRules.map((row) => ({ ruleId: row.ruleId, source: row.source, action: row.action, count: row.count })),
      20,
    ),
    topIps: sortAndLimit(
      topIpsWithValue.map((row) => {
        const geo = geoMap.get(row.value) ?? null;
        return {
          ip: row.value,
          count: row.count,
          country: geo?.countryCode || geo?.country || null,
          location: formatLocation(geo) || null,
        };
      }),
      15,
    ),
    topCountries: sortAndLimit(
      topCountriesRaw.map((row) => ({ value: row.value, count: row.count })),
      10,
    ),
    topHosts: sortAndLimit(
      topHostsRaw.map((row) => ({ value: row.value, count: row.count })),
      10,
    ),
    topPaths: sortAndLimit(
      topPathsRaw.map((row) => ({ value: row.value, count: row.count })),
      15,
    ),
  });

  return {
    zonesChecked: zoneIds.length,
    spikesDetected: flaggedZones.length,
    emailSent: true,
    cooldownActive: false,
  };
}

function formatHourWindow(start: Date, end: Date): string {
  const fmt = (date: Date) =>
    `${date.getUTCHours().toString().padStart(2, '0')}:${date.getUTCMinutes().toString().padStart(2, '0')}`;
  return `Last hour (UTC ${fmt(start)}–${fmt(end)})`;
}
