import type { Breadcrumb, Event as SentryEvent } from '@sentry/react';
import { describe, expect, it } from 'vitest';
import { scrubErrorTrackerBreadcrumb, scrubErrorTrackerEvent } from '../errorTracker.redaction';

describe('scrubErrorTrackerBreadcrumb', () => {
  it('strips query strings from fetch, xhr and navigation breadcrumbs', () => {
    const fetchCrumb: Breadcrumb = {
      category: 'fetch',
      data: { method: 'GET', url: 'https://app.test/api/query?soql=SELECT+Id+FROM+Account&token=abc', status_code: 500 },
    };
    expect(scrubErrorTrackerBreadcrumb(fetchCrumb).data).toEqual({ method: 'GET', url: 'https://app.test/api/query', status_code: 500 });

    const navCrumb: Breadcrumb = {
      category: 'navigation',
      data: { from: '/app/teams/invite?teamId=1&token=secret', to: '/app/home#frag' },
    };
    expect(scrubErrorTrackerBreadcrumb(navCrumb).data).toEqual({ from: '/app/teams/invite', to: '/app/home' });
    // original is untouched
    expect(navCrumb.data?.from).toContain('token=secret');
  });

  it('redacts secret keys in breadcrumb data and truncates long messages', () => {
    const crumb: Breadcrumb = {
      category: 'console',
      message: 'm'.repeat(1_000),
      data: { arguments: [{ access_token: 'x', ok: true }] },
    };
    const scrubbed = scrubErrorTrackerBreadcrumb(crumb);
    expect(scrubbed.message?.length).toBe(501);
    expect(scrubbed.data).toEqual({ arguments: [{ access_token: '[REDACTED]', ok: true }] });
  });
});

describe('scrubErrorTrackerEvent', () => {
  it('scrubs request, transaction, extras, contexts, tags and breadcrumbs while keeping the exception', () => {
    const event: SentryEvent = {
      transaction: '/auth/password-reset/verify?email=a%40b.com&code=1234',
      request: {
        url: 'https://app.test/app/teams/invite?teamId=1&token=secret',
        query_string: 'teamId=1&token=secret',
        cookies: { session: 'cookie-value' },
        headers: { Authorization: 'Bearer x', 'User-Agent': 'ua' },
      },
      extra: { query: 'SELECT Id FROM Account', body: { password: 'p', email: 'a@b.com' } },
      contexts: { oauth: { code: 'c', state: 's', provider: 'google' } },
      tags: { refreshToken: 'r', feature: 'query' },
      breadcrumbs: [{ category: 'fetch', data: { url: '/api/me?token=t' } }],
      exception: { values: [{ type: 'Error', value: 'Something failed: INVALID_FIELD' }] },
    };

    const scrubbed = scrubErrorTrackerEvent(event);

    expect(scrubbed.transaction).toBe('/auth/password-reset/verify');
    expect(scrubbed.request).toEqual({
      url: 'https://app.test/app/teams/invite',
      headers: { Authorization: '[REDACTED]', 'User-Agent': 'ua' },
    });
    expect(scrubbed.extra).toEqual({ query: 'SELECT Id FROM Account', body: { password: '[REDACTED]', email: 'a@b.com' } });
    expect(scrubbed.contexts).toEqual({ oauth: { code: '[REDACTED]', state: '[REDACTED]', provider: 'google' } });
    expect(scrubbed.tags).toEqual({ refreshToken: '[REDACTED]', feature: 'query' });
    expect(scrubbed.breadcrumbs).toEqual([{ category: 'fetch', data: { url: '/api/me' } }]);
    expect(scrubbed.exception).toEqual(event.exception);
    expect(JSON.stringify(scrubbed)).not.toContain('secret');
    // original event is untouched
    expect(event.request?.query_string).toBe('teamId=1&token=secret');
  });

  it('truncates oversized extras', () => {
    const scrubbed = scrubErrorTrackerEvent({ extra: { item: 'z'.repeat(5_000) } });
    expect(String(scrubbed.extra?.item).length).toBeLessThan(2_100);
    expect(scrubbed.extra?.item).toContain('[truncated 3000 chars]');
  });

  it('returns events without optional sections unchanged', () => {
    const event: SentryEvent = { message: 'hello' };
    expect(scrubErrorTrackerEvent(event)).toEqual({ message: 'hello' });
  });
});
