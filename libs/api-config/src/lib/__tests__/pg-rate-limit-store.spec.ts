import type { Options } from 'express-rate-limit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PgRateLimitStore } from '../pg-rate-limit-store';

const pgPoolMock = vi.hoisted(() => ({
  query: vi.fn(),
}));

vi.mock('../api-db-config', () => ({ pgPool: pgPoolMock }));

// These tests mock pgPool.query, so they verify how the store builds queries and parses
// responses. The window-reset/expiry semantics live in the SQL itself (ON CONFLICT ... CASE),
// which a mock cannot exercise — that behavior needs an integration test against a real Postgres.
describe('PgRateLimitStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('increment', () => {
    it('parses the returned row into totalHits and resetTime', async () => {
      const expiresAt = new Date('2026-06-01T00:01:00.000Z');
      pgPoolMock.query.mockResolvedValueOnce({ rows: [{ hits: 3, expires_at: expiresAt }] });
      const store = new PgRateLimitStore();

      const result = await store.increment('1.2.3.4');

      expect(result.totalHits).toBe(3);
      expect(result.resetTime).toEqual(expiresAt);
    });

    it('passes the default-prefixed key and the default windowMs as query params', async () => {
      pgPoolMock.query.mockResolvedValueOnce({ rows: [{ hits: 1, expires_at: new Date() }] });
      const store = new PgRateLimitStore();

      await store.increment('1.2.3.4');

      const [sql, params] = pgPoolMock.query.mock.calls[0];
      expect(sql).toContain('INSERT INTO rate_limit_hits');
      expect(params).toEqual(['rl:1.2.3.4', 60_000]);
    });

    it('uses a custom prefix when provided', async () => {
      pgPoolMock.query.mockResolvedValueOnce({ rows: [{ hits: 1, expires_at: new Date() }] });
      const store = new PgRateLimitStore({ prefix: 'login:' });

      await store.increment('1.2.3.4');

      const [, params] = pgPoolMock.query.mock.calls[0];
      expect(params[0]).toBe('login:1.2.3.4');
    });

    it('uses the windowMs supplied via init()', async () => {
      pgPoolMock.query.mockResolvedValueOnce({ rows: [{ hits: 1, expires_at: new Date() }] });
      const store = new PgRateLimitStore();
      store.init({ windowMs: 15 * 60_000 } as Options);

      await store.increment('1.2.3.4');

      const [, params] = pgPoolMock.query.mock.calls[0];
      expect(params[1]).toBe(15 * 60_000);
    });
  });

  describe('get', () => {
    it('returns undefined when no live row matches', async () => {
      pgPoolMock.query.mockResolvedValueOnce({ rows: [] });
      const store = new PgRateLimitStore();

      const result = await store.get('1.2.3.4');

      expect(result).toBeUndefined();
    });

    it('returns parsed info when a live row exists', async () => {
      const expiresAt = new Date('2026-06-01T00:01:00.000Z');
      pgPoolMock.query.mockResolvedValueOnce({ rows: [{ hits: 5, expires_at: expiresAt }] });
      const store = new PgRateLimitStore();

      const result = await store.get('1.2.3.4');

      expect(result).toEqual({ totalHits: 5, resetTime: expiresAt });
    });

    it('only selects rows that have not expired', async () => {
      pgPoolMock.query.mockResolvedValueOnce({ rows: [] });
      const store = new PgRateLimitStore();

      await store.get('1.2.3.4');

      const [sql, params] = pgPoolMock.query.mock.calls[0];
      expect(sql).toContain('expires_at > now()');
      expect(params).toEqual(['rl:1.2.3.4']);
    });
  });

  describe('decrement', () => {
    it('decrements the prefixed key without dropping below zero', async () => {
      pgPoolMock.query.mockResolvedValueOnce({ rows: [] });
      const store = new PgRateLimitStore();

      await store.decrement('1.2.3.4');

      const [sql, params] = pgPoolMock.query.mock.calls[0];
      expect(sql).toContain('GREATEST(hits - 1, 0)');
      expect(params).toEqual(['rl:1.2.3.4']);
    });
  });

  describe('resetKey', () => {
    it('deletes the prefixed key', async () => {
      pgPoolMock.query.mockResolvedValueOnce({ rows: [] });
      const store = new PgRateLimitStore();

      await store.resetKey('1.2.3.4');

      const [sql, params] = pgPoolMock.query.mock.calls[0];
      expect(sql).toContain('DELETE FROM rate_limit_hits');
      expect(params).toEqual(['rl:1.2.3.4']);
    });
  });
});
