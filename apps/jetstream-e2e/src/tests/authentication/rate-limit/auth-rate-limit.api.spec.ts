import { HTTP } from '@jetstream/shared/constants';
import { expect, test } from '@playwright/test';

// Mirrors the real limits defined in auth.routes.ts
const LAX_REAL_LIMIT = 25; // 25 req / 1 min — applied to /session
const STRICT_REAL_LIMIT = 20; // 20 req / 5 min — applied to /sso/discover

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Auth rate limiting', () => {
  test.describe.configure({ mode: 'serial' });

  test('elevated limits apply in dev/CI without the bypass header', async ({ request }) => {
    // In dev/CI, the limit is elevated to 10000. Sending more requests than the real
    // STRICT limit should all succeed when the bypass header is absent.
    // Uses /sso/discover (STRICT limiter) to avoid interfering with other test suites
    // that hit LAX endpoints like /csrf.
    const requestCount = STRICT_REAL_LIMIT + 5;
    const responses = await Promise.all(
      Array.from({ length: requestCount }, () =>
        request.post('/api/auth/sso/discover', {
          data: { email: 'nobody@rate-limit-test.invalid' },
        }),
      ),
    );

    const rateLimited = responses.filter((res) => res.status() === 429);
    expect(rateLimited).toHaveLength(0);
  });

  test('real limits are enforced when x-use-real-rate-limit header is present', async ({ request }) => {
    // With the bypass header, the real LAX limit (25 req/min) applies.
    // Uses /session (LAX limiter) — isolated from the STRICT limiter used in the test above.
    // Keep sending until we see a 429; it must arrive within maxAttempts.
    // (Prior requests from other test files may have already consumed part of the pool,
    // so we allow some slack — but the 429 must still appear before we exceed the real limit.)
    const maxAttempts = LAX_REAL_LIMIT + 10;
    let hitRateLimit = false;
    const key = `test-key-${Date.now()}`; // ensure we have a clean slate and aren't affected by prior tests
    const limit = 25; // must match the real limit in auth.routes.ts

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const res = await request.get('/api/auth/session', {
        headers: {
          [HTTP.HEADERS.X_DEV_NO_RATE_LIMIT_BYPASS]: '1',
          [HTTP.HEADERS.X_DEV_RATE_LIMIT_KEY]: key,
        },
      });
      expect(res.headers()['ratelimit-limit']).toEqual(`${limit}`);
      expect(res.headers()['ratelimit-remaining']).toEqual(`${Math.max(limit - attempt - 1, 0)}`);
      // eslint-disable-next-line playwright/no-conditional-in-test
      if (res.status() === 429) {
        hitRateLimit = true;
        break;
      }
    }

    expect(hitRateLimit).toBe(true);
  });
});
