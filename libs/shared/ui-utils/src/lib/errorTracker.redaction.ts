import { redactSensitiveTelemetryData, sanitizeUrlForTelemetry } from '@jetstream/shared/utils';
import type { Breadcrumb, Event as SentryEvent } from '@sentry/react';

const BREADCRUMB_URL_KEYS = ['url', 'from', 'to'] as const;
const MAX_BREADCRUMB_MESSAGE_LENGTH = 500;

/**
 * Scrub a breadcrumb before it is stored or sent: fetch/xhr/navigation urls lose their query strings and
 * token-like path segments, data is key-redacted and bounded, and free-text messages are truncated.
 * Pure: returns a new breadcrumb.
 */
export function scrubErrorTrackerBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb {
  const scrubbed: Breadcrumb = { ...breadcrumb };
  if (typeof scrubbed.message === 'string' && scrubbed.message.length > MAX_BREADCRUMB_MESSAGE_LENGTH) {
    scrubbed.message = `${scrubbed.message.slice(0, MAX_BREADCRUMB_MESSAGE_LENGTH)}…`;
  }
  if (scrubbed.data) {
    const data: Record<string, unknown> = { ...scrubbed.data };
    for (const key of BREADCRUMB_URL_KEYS) {
      if (typeof data[key] === 'string') {
        data[key] = sanitizeUrlForTelemetry(data[key]);
      }
    }
    scrubbed.data = redactSensitiveTelemetryData(data);
  }
  return scrubbed;
}

/**
 * Scrub an error event before it leaves the browser. Covers every place caller-supplied or
 * auto-collected data lands: request url/query/headers/cookies, the transaction name, extras,
 * contexts, tags and breadcrumbs. Exception messages and stack traces are left intact.
 * Pure: returns a new event.
 */
export function scrubErrorTrackerEvent<T extends SentryEvent>(event: T): T {
  const scrubbed: T = { ...event };
  if (scrubbed.request) {
    const { url, query_string: _queryString, cookies: _cookies, ...request } = scrubbed.request;
    scrubbed.request = redactSensitiveTelemetryData({
      ...request,
      ...(typeof url === 'string' ? { url: sanitizeUrlForTelemetry(url) } : {}),
    });
  }
  if (typeof scrubbed.transaction === 'string') {
    scrubbed.transaction = sanitizeUrlForTelemetry(scrubbed.transaction);
  }
  if (scrubbed.extra) {
    scrubbed.extra = redactSensitiveTelemetryData(scrubbed.extra);
  }
  if (scrubbed.contexts) {
    scrubbed.contexts = redactSensitiveTelemetryData(scrubbed.contexts);
  }
  if (scrubbed.tags) {
    scrubbed.tags = redactSensitiveTelemetryData(scrubbed.tags);
  }
  if (scrubbed.breadcrumbs) {
    scrubbed.breadcrumbs = scrubbed.breadcrumbs.map(scrubErrorTrackerBreadcrumb);
  }
  return scrubbed;
}
