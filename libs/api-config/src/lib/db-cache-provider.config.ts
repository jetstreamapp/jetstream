import { Prisma } from '@jetstream/prisma';
import { NOOP } from '@jetstream/shared/utils';
import { CacheItem, CacheProvider } from '@node-saml/node-saml';
import { prisma } from './api-db-config';

/**
 * A generic Postgres-backed cache provider.
 *
 * Implements node-saml's CacheProvider interface but is suitable for any use case
 * that needs a shared, expiring key-value store across worker processes or server
 * instances (where in-memory caches are not shared).
 *
 * Keys are namespaced using a prefix to avoid collisions between callers:
 *   stored key = "${namespace}:${key}"
 *
 * Cleanup: expired rows are removed lazily on access. Call `DbCacheProvider.cleanupExpired()`
 * periodically (e.g., at startup) to remove rows that were never accessed.
 */
export class DbCacheProvider implements CacheProvider {
  constructor(
    private readonly namespace: string,
    private readonly ttlMs: number,
  ) {}

  private buildKey(key: string): string {
    return `${this.namespace}:${key}`;
  }

  async saveAsync(key: string, value: string): Promise<CacheItem | null> {
    const dbKey = this.buildKey(key);
    const createdAt = new Date();
    const expiresAt = new Date(createdAt.getTime() + this.ttlMs);

    await prisma.cacheEntry.upsert({
      where: { key: dbKey },
      create: { key: dbKey, value, createdAt, expiresAt },
      update: { value, expiresAt },
    });

    return { createdAt: createdAt.getTime(), value };
  }

  async getAsync(key: string): Promise<string | null> {
    const dbKey = this.buildKey(key);
    const now = new Date();

    const entry = await prisma.cacheEntry.findUnique({ where: { key: dbKey } });

    if (!entry) {
      return null;
    }

    if (entry.expiresAt <= now) {
      // Lazy cleanup — fire and forget, don't block the response
      prisma.cacheEntry.delete({ where: { key: dbKey } }).catch(NOOP);
      return null;
    }

    return entry.value;
  }

  async removeAsync(key: string | null): Promise<string | null> {
    if (!key) {
      return null;
    }

    const dbKey = this.buildKey(key);

    try {
      const entry = await prisma.cacheEntry.delete({ where: { key: dbKey } });
      return entry.value;
    } catch {
      // Entry already gone — not an error
      return null;
    }
  }

  /**
   * Atomically record a one-time-use key. Returns true if this call was the first to record it
   * within the current TTL window, false if an unexpired row for the key is already present.
   *
   * Use for replay detection where two workers must not both observe "not yet consumed" for the
   * same key — the primary-key INSERT is the atomicity boundary, so the get+remove race that
   * exists in the stock CacheProvider interface cannot occur here. Expired rows are reclaimed in
   * the same transaction so a stale "consumed" marker past its TTL does not block a new first use
   * if `cleanupExpired()` has not run recently.
   */
  async consumeOnceAsync(key: string): Promise<boolean> {
    const dbKey = this.buildKey(key);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.ttlMs);
    try {
      await prisma.$transaction(async (tx) => {
        await tx.cacheEntry.deleteMany({ where: { key: dbKey, expiresAt: { lt: now } } });
        await tx.cacheEntry.create({
          data: { key: dbKey, value: '1', createdAt: now, expiresAt },
        });
      });
      return true;
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return false;
      }
      throw err;
    }
  }

  /**
   * Atomically counts an occurrence of `key` within a fixed window and returns the new total.
   *
   * The first increment opens a window of ttlMs; later increments inside it only bump the count and
   * leave the expiry alone, so a window never slides and the count can never be stretched out
   * indefinitely by whoever keeps incrementing it. An expired row is reused as a fresh window with a
   * count of 1. The INSERT ... ON CONFLICT is the atomicity boundary, so concurrent callers each see a
   * distinct total - a plain get-then-save would let a burst of parallel calls all observe the same
   * starting value.
   *
   * Only meant for keys that this method alone writes to: the stored value is parsed as an integer.
   */
  async incrementAsync(key: string): Promise<number> {
    const dbKey = this.buildKey(key);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.ttlMs);

    const rows = await prisma.$queryRaw<{ value: string }[]>`
      INSERT INTO "cache_entry" ("key", "value", "createdAt", "expiresAt")
      VALUES (${dbKey}, '1', ${now}, ${expiresAt})
      ON CONFLICT ("key") DO UPDATE SET
        "value" = CASE WHEN "cache_entry"."expiresAt" <= ${now} THEN '1' ELSE ("cache_entry"."value"::int + 1)::text END,
        "createdAt" = CASE WHEN "cache_entry"."expiresAt" <= ${now} THEN ${now} ELSE "cache_entry"."createdAt" END,
        "expiresAt" = CASE WHEN "cache_entry"."expiresAt" <= ${now} THEN ${expiresAt} ELSE "cache_entry"."expiresAt" END
      RETURNING "value"
    `;

    return Number(rows[0]?.value ?? '1');
  }

  /**
   * Delete all expired cache rows across all namespaces.
   * Call this at startup and/or on a periodic interval to keep the table clean.
   */
  static async cleanupExpired(): Promise<number> {
    const result = await prisma.cacheEntry.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });
    return result.count;
  }
}
