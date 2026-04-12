import { sendCloudflareSecurityAlertEmail } from '@jetstream/email';
import { PrismaClient } from '@jetstream/prisma';
import { ENV } from '../config/env-config';
import { logger } from '../config/logger.config';
import {
  ActionTotal,
  aggregateActionTotals,
  getConfiguredZoneIds,
  queryTopDimension,
  queryTopRules,
  queryTotalsByAction,
  TopDimensionRow,
  TopRuleRow,
} from './cloudflare.utils';
import { formatLocation, GeoIpResult, lookupIpAddresses } from './geo-ip.utils';

export interface DailyDigestResult {
  totalEvents: number;
  zonesReported: number;
}

// prisma is kept in the signature for consistency with other cron utility entry points and
// so we can later add persistence of digest runs without changing the call sites.
export async function sendCloudflareDailyDigest(_prisma: PrismaClient): Promise<DailyDigestResult> {
  if (!ENV.CLOUDFLARE_API_TOKEN) {
    throw new Error('CLOUDFLARE_API_TOKEN is not configured');
  }

  const zoneIds = getConfiguredZoneIds();
  const recipient = ENV.CLOUDFLARE_ALERT_RECIPIENT || ENV.ADMIN_NOTIFICATION_EMAIL;
  if (!recipient) {
    throw new Error('CLOUDFLARE_ALERT_RECIPIENT or ADMIN_NOTIFICATION_EMAIL must be configured');
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  logger.info(
    { zones: zoneIds.length, windowStart: windowStart.toISOString(), windowEnd: now.toISOString() },
    'Starting Cloudflare daily digest',
  );

  const allTotals: ActionTotal[] = [];
  const allTopRules: TopRuleRow[] = [];
  const allTopIps: TopDimensionRow[] = [];
  const allTopCountries: TopDimensionRow[] = [];
  const allTopHosts: TopDimensionRow[] = [];
  const allTopPaths: TopDimensionRow[] = [];

  for (const zoneId of zoneIds) {
    try {
      const [totals, rules, ips, countries, hosts, paths] = await Promise.all([
        queryTotalsByAction(zoneId, windowStart, now),
        queryTopRules(zoneId, windowStart, now, 20),
        queryTopDimension(zoneId, windowStart, now, 'clientIP', 50),
        queryTopDimension(zoneId, windowStart, now, 'clientCountryName', 50),
        queryTopDimension(zoneId, windowStart, now, 'clientRequestHTTPHost', 50),
        queryTopDimension(zoneId, windowStart, now, 'clientRequestPath', 50),
      ]);
      allTotals.push(...totals);
      allTopRules.push(...rules);
      allTopIps.push(...ips);
      allTopCountries.push(...countries);
      allTopHosts.push(...hosts);
      allTopPaths.push(...paths);
    } catch (error) {
      logger.error({ error, zoneId }, 'Failed to gather daily digest data for zone');
    }
  }

  const aggregatedTotals = aggregateActionTotals(allTotals);

  // Merge cross-zone IPs and cap to the top 15 BEFORE hitting the geo-IP service — otherwise
  // with N zones we'd enrich up to `N * 50` IPs per run even though only 15 end up in the email.
  const topMergedIps = mergeByKey(
    allTopIps.filter((row) => !!row.value),
    (row) => row.value,
    15,
  );
  const ipsToEnrich = topMergedIps.map((row) => row.value);
  const geoMap: Map<string, GeoIpResult | null> =
    ipsToEnrich.length > 0 ? await lookupIpAddresses(ipsToEnrich) : new Map();

  const generatedAt = now.toLocaleString('en-US', { timeZone: 'America/Denver', dateStyle: 'full', timeStyle: 'short' });

  await sendCloudflareSecurityAlertEmail({
    to: recipient,
    mode: 'digest',
    generatedAt,
    windowDescription: 'Last 24 hours',
    zones: zoneIds.map((zoneId) => ({ zoneId, label: zoneId })),
    totals: aggregatedTotals,
    topRules: mergeByKey(allTopRules, (row) => `${row.ruleId ?? ''}|${row.source ?? ''}|${row.action}`, 25),
    topIps: topMergedIps.map((row) => {
      const geo = geoMap.get(row.value) ?? null;
      return {
        ip: row.value,
        count: row.count,
        country: geo?.countryCode || geo?.country || null,
        location: formatLocation(geo) || null,
      };
    }),
    topCountries: mergeByKey(allTopCountries, (row) => row.value, 25).map((row) => ({ value: row.value, count: row.count })),
    topHosts: mergeByKey(allTopHosts, (row) => row.value, 25).map((row) => ({ value: row.value, count: row.count })),
    topPaths: mergeByKey(allTopPaths, (row) => row.value, 50).map((row) => ({ value: row.value, count: row.count })),
  });

  logger.info({ totalEvents: aggregatedTotals.total, zonesReported: zoneIds.length, to: recipient }, 'Cloudflare daily digest email sent');

  return { totalEvents: aggregatedTotals.total, zonesReported: zoneIds.length };
}

/**
 * Merges rows that share a key (by summing counts) and returns the top N sorted by count.
 * Used for cross-zone aggregation in the digest.
 */
function mergeByKey<T extends { count: number }>(rows: T[], keyFn: (row: T) => string, limit: number): T[] {
  const map = new Map<string, T>();
  for (const row of rows) {
    const key = keyFn(row);
    const existing = map.get(key);
    if (existing) {
      existing.count += row.count;
    } else {
      map.set(key, { ...row });
    }
  }
  return Array.from(map.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
