import type * as Sentry from '@sentry/node';
import { describe, expect, it } from 'vitest';
import { scrubSensitiveEventData } from '../api-sentry-config';

describe('scrubSensitiveEventData', () => {
  it('redacts sensitive keys in event.extra (incl. forwarded req.body) while preserving the rest', () => {
    const event = {
      extra: {
        url: '/api/auth/callback/credentials',
        userId: 'user-1',
        requestId: 'req-1',
        body: {
          email: 'person@example.com',
          password: 'hunter2',
          csrfToken: 'abc.def',
          code: '123456',
          secretToken: 'totp-secret',
        },
      },
    } as unknown as Sentry.Event;

    const scrubbed = scrubSensitiveEventData(event);
    const body = (scrubbed.extra as any).body;

    expect(body.password).toBe('[REDACTED]');
    expect(body.csrfToken).toBe('[REDACTED]');
    expect(body.code).toBe('[REDACTED]');
    expect(body.secretToken).toBe('[REDACTED]');
    // non-sensitive values are preserved for debugging
    expect(body.email).toBe('person@example.com');
    expect((scrubbed.extra as any).url).toBe('/api/auth/callback/credentials');
    expect((scrubbed.extra as any).userId).toBe('user-1');
  });

  it('redacts sensitive query/params inside the request context', () => {
    const event = {
      contexts: {
        request: {
          method: 'GET',
          url: '/api/something',
          query: { token: 'leak-me', page: '2' },
          params: { id: 'abc' },
        },
      },
    } as unknown as Sentry.Event;

    const scrubbed = scrubSensitiveEventData(event);
    const request = (scrubbed.contexts as any).request;

    expect(request.query.token).toBe('[REDACTED]');
    expect(request.query.page).toBe('2');
    expect(request.params.id).toBe('abc');
  });

  it('does not over-redact ambiguous short keys used as substrings (statusCode, osId)', () => {
    const event = {
      extra: { meta: { statusCode: 500, osId: 'mac', accessToken: 'x' } },
    } as unknown as Sentry.Event;

    const meta = (scrubSensitiveEventData(event).extra as any).meta;
    expect(meta.statusCode).toBe(500);
    expect(meta.osId).toBe('mac');
    // ...but real token keys are still caught via substring match
    expect(meta.accessToken).toBe('[REDACTED]');
  });

  it('scrubs event.request headers and data (Authorization, cookie, SAMLResponse)', () => {
    const event = {
      request: {
        method: 'POST',
        url: '/api/auth/sso/saml/t1/acs',
        headers: { authorization: 'Bearer tok', cookie: 'sessionid=abc', 'user-agent': 'UA' },
        data: { SAMLResponse: 'base64blob', RelayState: '/app', password: 'x' },
      },
    } as unknown as Sentry.Event;

    const request = scrubSensitiveEventData(event).request as any;
    expect(request.headers.authorization).toBe('[REDACTED]');
    expect(request.headers.cookie).toBe('[REDACTED]');
    expect(request.headers['user-agent']).toBe('UA');
    expect(request.data.SAMLResponse).toBe('[REDACTED]');
    expect(request.data.password).toBe('[REDACTED]');
    expect(request.data.RelayState).toBe('/app');
  });

  it('redacts subtrees deeper than the depth limit (fail-safe, not passed through)', () => {
    // 7 nested levels exceeds MAX_REDACT_DEPTH (6), so the deepest container is redacted wholesale.
    const event = { extra: { a: { b: { c: { d: { e: { f: { g: 'deep-secret' } } } } } } } } as unknown as Sentry.Event;
    const extra = scrubSensitiveEventData(event).extra as any;
    expect(extra.a.b.c.d.e.f).toBe('[REDACTED]');
  });

  it('handles arrays and circular references without throwing', () => {
    const circular: Record<string, unknown> = { password: 'secret' };
    circular.self = circular;
    const event = {
      extra: { list: [{ token: 'a' }, { ok: 'b' }], circular },
    } as unknown as Sentry.Event;

    const scrubbed = scrubSensitiveEventData(event);
    const extra = scrubbed.extra as any;

    expect(extra.list[0].token).toBe('[REDACTED]');
    expect(extra.list[1].ok).toBe('b');
    expect(extra.circular.password).toBe('[REDACTED]');
  });
});
