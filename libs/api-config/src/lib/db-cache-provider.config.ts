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
