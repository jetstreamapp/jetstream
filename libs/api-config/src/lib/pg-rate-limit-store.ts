import type { ClientRateLimitInfo, Options, Store } from 'express-rate-limit';
import { pgPool } from './api-db-config';

/**
 * Postgres-backed express-rate-limit store so security-relevant limits hold across all
 * horizontally-scaled instances/containers (the default MemoryStore/ClusterMemoryStore is shared
 * only within a single host's worker pool, so every per-IP ceiling otherwise multiplies by the
 * container count).
 *
 * Backed by the `rate_limit_hits` table (Prisma model `RateLimitHit`). Limiters that use this store
 * are configured with `passOnStoreError: true`, so a transient DB error fails OPEN (the request is
 * allowed) rather than erroring — availability is preferred over a hard throttle outage.
 */
export class PgRateLimitStore implements Store {
  private windowMs = 60_000;
  prefix: string;
  localKeys = false;

  constructor(options: { prefix?: string } = {}) {
    this.prefix = options.prefix ?? 'rl:';
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;
  }

  private prefixedKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    // Atomic upsert: increment within the current window, or reset to 1 if the window has expired.
    const result = await pgPool.query<{ hits: number; expires_at: Date }>(
      `INSERT INTO rate_limit_hits (key, hits, expires_at)
       VALUES ($1, 1, now() + ($2::double precision * interval '1 millisecond'))
       ON CONFLICT (key) DO UPDATE SET
         hits = CASE WHEN rate_limit_hits.expires_at <= now() THEN 1 ELSE rate_limit_hits.hits + 1 END,
         expires_at = CASE WHEN rate_limit_hits.expires_at <= now()
                           THEN now() + ($2::double precision * interval '1 millisecond')
                           ELSE rate_limit_hits.expires_at END
       RETURNING hits, expires_at`,
      [this.prefixedKey(key), this.windowMs],
    );
    const row = result.rows[0];
    return { totalHits: row.hits, resetTime: new Date(row.expires_at) };
  }

  async decrement(key: string): Promise<void> {
    await pgPool.query(`UPDATE rate_limit_hits SET hits = GREATEST(hits - 1, 0) WHERE key = $1 AND expires_at > now()`, [
      this.prefixedKey(key),
    ]);
  }

  async resetKey(key: string): Promise<void> {
    await pgPool.query(`DELETE FROM rate_limit_hits WHERE key = $1`, [this.prefixedKey(key)]);
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const result = await pgPool.query<{ hits: number; expires_at: Date }>(
      `SELECT hits, expires_at FROM rate_limit_hits WHERE key = $1 AND expires_at > now()`,
      [this.prefixedKey(key)],
    );
    const row = result.rows[0];
    if (!row) {
      return undefined;
    }
    return { totalHits: row.hits, resetTime: new Date(row.expires_at) };
  }
}
