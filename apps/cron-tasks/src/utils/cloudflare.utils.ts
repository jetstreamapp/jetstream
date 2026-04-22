import { ENV } from '../config/env-config';

const CLOUDFLARE_GRAPHQL_ENDPOINT = 'https://api.cloudflare.com/client/v4/graphql';

export const BLOCKED_ACTIONS = ['block', 'managed_challenge', 'jschallenge', 'challenge'] as const;
export type BlockedAction = (typeof BLOCKED_ACTIONS)[number];

export type TopDimension = 'clientIP' | 'clientCountryName' | 'clientRequestHTTPHost' | 'clientRequestPath';

export interface HourlyBlockCount {
  datetimeHour: string;
  action: string;
  count: number;
}

export interface ActionTotal {
  action: string;
  count: number;
}

export interface TopRuleRow {
  action: string;
  ruleId: string | null;
  source: string | null;
  count: number;
}

export interface TopDimensionRow {
  value: string;
  count: number;
}

export interface FirewallEventGroupRow {
  hourBucket: Date;
  ruleId: string | null;
  ruleSource: string | null;
  action: string;
  clientIp: string | null;
  clientAsn: number | null;
  clientAsnDescription: string | null;
  clientCountry: string | null;
  httpHost: string;
  requestPath: string;
  count: number;
}

export interface AggregatedActionTotals {
  blocked: number;
  challenged: number;
  managed: number;
  total: number;
}

/**
 * Bucket raw per-action totals into the summary shape used by the WAF digest and spike alert emails.
 * `blocked` counts the `block` action, `managed` counts `managed_challenge`, and `challenged` covers
 * the remaining challenge actions (`jschallenge`, `challenge`). Shared between the two alert paths so
 * they always present the same numbers.
 */
export function aggregateActionTotals(totals: ActionTotal[]): AggregatedActionTotals {
  let blocked = 0;
  let challenged = 0;
  let managed = 0;
  for (const row of totals) {
    if (row.action === 'block') {
      blocked += row.count;
    } else if (row.action === 'managed_challenge') {
      managed += row.count;
    } else if (BLOCKED_ACTIONS.includes(row.action as BlockedAction)) {
      challenged += row.count;
    }
  }
  return { blocked, challenged, managed, total: blocked + challenged + managed };
}

/**
 * Returns a copy of `rows` sorted descending by `count` and trimmed to the first `limit` entries.
 */
export function sortAndLimit<T extends { count: number }>(rows: T[], limit: number): T[] {
  return [...rows].sort((a, b) => b.count - a.count).slice(0, limit);
}

interface GraphQLResponse<T> {
  data?: T;
  errors?: Array<{ message: string; path?: unknown; extensions?: unknown }>;
}

/**
 * Executes a GraphQL query against the Cloudflare Analytics API.
 * Throws on non-200 responses and on responses that contain a top-level `errors` array.
 */
export async function cloudflareGraphQL<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  if (!ENV.CLOUDFLARE_API_TOKEN) {
    throw new Error('CLOUDFLARE_API_TOKEN is not configured');
  }

  const response = await fetch(CLOUDFLARE_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${ENV.CLOUDFLARE_API_TOKEN}`,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    throw new Error(`Cloudflare GraphQL request failed with status ${response.status}: ${bodyText.slice(0, 500)}`);
  }

  const body = (await response.json()) as GraphQLResponse<T>;

  if (body.errors && body.errors.length > 0) {
    const messages = body.errors.map((err) => err.message).join('; ');
    throw new Error(`Cloudflare GraphQL errors: ${messages}`);
  }

  if (!body.data) {
    throw new Error('Cloudflare GraphQL response missing data');
  }

  return body.data;
}

/**
 * Parses the comma-separated CLOUDFLARE_ZONE_IDS env var into a trimmed list of zone tags.
 * Throws if unset or empty.
 */
export function getConfiguredZoneIds(): string[] {
  const raw = ENV.CLOUDFLARE_ZONE_IDS;
  if (!raw) {
    throw new Error('CLOUDFLARE_ZONE_IDS is not configured');
  }
  const zones = raw
    .split(',')
    .map((zone) => zone.trim())
    .filter(Boolean);
  if (zones.length === 0) {
    throw new Error('CLOUDFLARE_ZONE_IDS is configured but contains no zones');
  }
  return zones;
}

function toIsoZ(date: Date): string {
  return date.toISOString();
}

/**
 * Returns per-hour block/challenge counts grouped by (datetimeHour, action) for the window.
 * Used by the spike detector to build a rolling baseline.
 */
export async function queryHourlyBlockCounts(zoneTag: string, since: Date, until: Date): Promise<HourlyBlockCount[]> {
  const query = /* GraphQL */ `
    query HourlyBlockCounts($zoneTag: String!, $since: Time!, $until: Time!, $actions: [String!]!) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          firewallEventsAdaptiveGroups(
            filter: { datetime_geq: $since, datetime_lt: $until, action_in: $actions }
            limit: 1000
            orderBy: [datetimeHour_ASC]
          ) {
            count
            dimensions {
              datetimeHour
              action
            }
          }
        }
      }
    }
  `;

  const data = await cloudflareGraphQL<{
    viewer: {
      zones: Array<{
        firewallEventsAdaptiveGroups: Array<{
          count: number;
          dimensions: { datetimeHour: string; action: string };
        }>;
      }>;
    };
  }>(query, {
    zoneTag,
    since: toIsoZ(since),
    until: toIsoZ(until),
    actions: [...BLOCKED_ACTIONS],
  });

  const groups = data.viewer.zones[0]?.firewallEventsAdaptiveGroups ?? [];
  return groups.map((group) => ({
    datetimeHour: group.dimensions.datetimeHour,
    action: group.dimensions.action,
    count: group.count,
  }));
}

/**
 * Returns total event counts grouped by action for the window.
 */
export async function queryTotalsByAction(zoneTag: string, since: Date, until: Date): Promise<ActionTotal[]> {
  const query = /* GraphQL */ `
    query TotalsByAction($zoneTag: String!, $since: Time!, $until: Time!, $actions: [String!]!) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          firewallEventsAdaptiveGroups(
            filter: { datetime_geq: $since, datetime_lt: $until, action_in: $actions }
            limit: 50
            orderBy: [count_DESC]
          ) {
            count
            dimensions {
              action
            }
          }
        }
      }
    }
  `;

  const data = await cloudflareGraphQL<{
    viewer: {
      zones: Array<{
        firewallEventsAdaptiveGroups: Array<{
          count: number;
          dimensions: { action: string };
        }>;
      }>;
    };
  }>(query, {
    zoneTag,
    since: toIsoZ(since),
    until: toIsoZ(until),
    actions: [...BLOCKED_ACTIONS],
  });

  const groups = data.viewer.zones[0]?.firewallEventsAdaptiveGroups ?? [];
  return groups.map((group) => ({
    action: group.dimensions.action,
    count: group.count,
  }));
}

/**
 * Returns top N (action, ruleId, source) groups sorted by count.
 */
export async function queryTopRules(zoneTag: string, since: Date, until: Date, limit: number): Promise<TopRuleRow[]> {
  const query = /* GraphQL */ `
    query TopRules($zoneTag: String!, $since: Time!, $until: Time!, $actions: [String!]!, $limit: Int!) {
      viewer {
        zones(filter: { zoneTag: $zoneTag }) {
          firewallEventsAdaptiveGroups(
            filter: { datetime_geq: $since, datetime_lt: $until, action_in: $actions }
            limit: $limit
            orderBy: [count_DESC]
          ) {
            count
            dimensions {
              action
              ruleId
              source
            }
          }
        }
      }
    }
  `;

  const data = await cloudflareGraphQL<{
    viewer: {
      zones: Array<{
        firewallEventsAdaptiveGroups: Array<{
          count: number;
          dimensions: { action: string; ruleId: string | null; source: string | null };
        }>;
      }>;
    };
  }>(query, {
    zoneTag,
    since: toIsoZ(since),
    until: toIsoZ(until),
    actions: [...BLOCKED_ACTIONS],
    limit,
  });

  const groups = data.viewer.zones[0]?.firewallEventsAdaptiveGroups ?? [];
  return groups.map((group) => ({
    action: group.dimensions.action,
    ruleId: group.dimensions.ruleId || null,
    source: group.dimensions.source || null,
    count: group.count,
  }));
}

/**
 * Returns top N rows for a single dimension (e.g. clientIP, clientCountryName, ...).
 * Uses separate static queries per dimension because Cloudflare's GraphQL
 * schema does not permit a dynamic dimension selection.
 */
export async function queryTopDimension(
  zoneTag: string,
  since: Date,
  until: Date,
  dimension: TopDimension,
  limit: number,
): Promise<TopDimensionRow[]> {
  const variables = {
    zoneTag,
    since: toIsoZ(since),
    until: toIsoZ(until),
    actions: [...BLOCKED_ACTIONS],
    limit,
  };

  const queriesByDimension: Record<TopDimension, string> = {
    clientIP: /* GraphQL */ `
      query TopClientIP($zoneTag: String!, $since: Time!, $until: Time!, $actions: [String!]!, $limit: Int!) {
        viewer {
          zones(filter: { zoneTag: $zoneTag }) {
            firewallEventsAdaptiveGroups(
              filter: { datetime_geq: $since, datetime_lt: $until, action_in: $actions }
              limit: $limit
              orderBy: [count_DESC]
            ) {
              count
              dimensions {
                clientIP
              }
            }
          }
        }
      }
    `,
    clientCountryName: /* GraphQL */ `
      query TopClientCountry($zoneTag: String!, $since: Time!, $until: Time!, $actions: [String!]!, $limit: Int!) {
        viewer {
          zones(filter: { zoneTag: $zoneTag }) {
            firewallEventsAdaptiveGroups(
              filter: { datetime_geq: $since, datetime_lt: $until, action_in: $actions }
              limit: $limit
              orderBy: [count_DESC]
            ) {
              count
              dimensions {
                clientCountryName
              }
            }
          }
        }
      }
    `,
    clientRequestHTTPHost: /* GraphQL */ `
      query TopClientHost($zoneTag: String!, $since: Time!, $until: Time!, $actions: [String!]!, $limit: Int!) {
        viewer {
          zones(filter: { zoneTag: $zoneTag }) {
            firewallEventsAdaptiveGroups(
              filter: { datetime_geq: $since, datetime_lt: $until, action_in: $actions }
              limit: $limit
              orderBy: [count_DESC]
            ) {
              count
              dimensions {
                clientRequestHTTPHost
              }
            }
          }
        }
      }
    `,
    clientRequestPath: /* GraphQL */ `
      query TopClientPath($zoneTag: String!, $since: Time!, $until: Time!, $actions: [String!]!, $limit: Int!) {
        viewer {
          zones(filter: { zoneTag: $zoneTag }) {
            firewallEventsAdaptiveGroups(
              filter: { datetime_geq: $since, datetime_lt: $until, action_in: $actions }
              limit: $limit
              orderBy: [count_DESC]
            ) {
              count
              dimensions {
                clientRequestPath
              }
            }
          }
        }
      }
    `,
  };

  const data = await cloudflareGraphQL<{
    viewer: {
      zones: Array<{
        firewallEventsAdaptiveGroups: Array<{
          count: number;
          dimensions: Record<string, string>;
        }>;
      }>;
    };
  }>(queriesByDimension[dimension], variables);

  const groups = data.viewer.zones[0]?.firewallEventsAdaptiveGroups ?? [];
  return groups.map((group) => ({
    value: group.dimensions[dimension] ?? '',
    count: group.count,
  }));
}

const FIREWALL_EVENT_GROUPS_BY_DIMENSIONS_QUERY = /* GraphQL */ `
  query FirewallEventGroupsByDimensions(
    $zoneTag: String!
    $since: Time!
    $until: Time!
    $actions: [String!]!
    $limit: Int!
  ) {
    viewer {
      zones(filter: { zoneTag: $zoneTag }) {
        firewallEventsAdaptiveGroups(
          filter: { datetime_geq: $since, datetime_lt: $until, action_in: $actions }
          limit: $limit
          orderBy: [count_DESC]
        ) {
          count
          dimensions {
            datetimeHour
            ruleId
            source
            action
            clientIP
            clientAsn
            clientASNDescription
            clientCountryName
            clientRequestHTTPHost
            clientRequestPath
          }
        }
      }
    }
  }
`;

interface FirewallEventGroupRawDimensions {
  datetimeHour: string;
  ruleId?: string | null;
  source?: string | null;
  action: string;
  clientIP?: string | null;
  clientAsn?: number | string | null;
  clientASNDescription?: string | null;
  clientCountryName?: string | null;
  clientRequestHTTPHost?: string | null;
  clientRequestPath?: string | null;
}

/**
 * Returns one row per (hour, rule, action, IP, ASN, country, host, path) combination
 * for the requested window. Used by the analytics archiver — callers should query a
 * single hour at a time so the response cap (1000 rows per call) doesn't truncate
 * the long tail.
 */
export async function queryFirewallEventGroupsByDimensions(
  zoneTag: string,
  since: Date,
  until: Date,
  limit: number,
): Promise<FirewallEventGroupRow[]> {
  const data = await cloudflareGraphQL<{
    viewer: {
      zones: Array<{
        firewallEventsAdaptiveGroups: Array<{
          count: number;
          dimensions: FirewallEventGroupRawDimensions;
        }>;
      }>;
    };
  }>(FIREWALL_EVENT_GROUPS_BY_DIMENSIONS_QUERY, {
    zoneTag,
    since: toIsoZ(since),
    until: toIsoZ(until),
    actions: [...BLOCKED_ACTIONS],
    limit,
  });

  const groups = data.viewer.zones[0]?.firewallEventsAdaptiveGroups ?? [];
  return groups.map((group) => normalizeFirewallEventGroupRow(group.count, group.dimensions));
}

function normalizeFirewallEventGroupRow(count: number, dimensions: FirewallEventGroupRawDimensions): FirewallEventGroupRow {
  return {
    hourBucket: new Date(dimensions.datetimeHour),
    ruleId: emptyToNull(dimensions.ruleId),
    ruleSource: emptyToNull(dimensions.source),
    action: dimensions.action,
    clientIp: emptyToNull(dimensions.clientIP),
    clientAsn: parseAsn(dimensions.clientAsn),
    clientAsnDescription: emptyToNull(dimensions.clientASNDescription),
    clientCountry: emptyToNull(dimensions.clientCountryName),
    httpHost: dimensions.clientRequestHTTPHost ?? '',
    requestPath: dimensions.clientRequestPath ?? '',
    count,
  };
}

function emptyToNull(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  return value;
}

function parseAsn(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.trunc(parsed);
}
