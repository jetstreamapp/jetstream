import { HTTP } from '@jetstream/shared/constants';
import type { ClientRateLimitInfo, IncrementResponse, Store } from 'express-rate-limit';
import { Options, rateLimit } from 'express-rate-limit';
import { prisma } from './api-db-config';
import { getExceptionLog, logger } from './api-logger';

export function createRateLimit(prefix: string, options: Partial<Options>) {
  return rateLimit({
    store: new PrismaRateLimitStore({ prefix }),
    windowMs: 1000 * 60 * 1, // 1 minute
    max: 50, // limit each IP to 50 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req, res, next, options) => {
      const isJson = (req.get(HTTP.HEADERS.ACCEPT) || '').includes(HTTP.CONTENT_TYPE.JSON);
      if (isJson) {
        res.status(options.statusCode).json({
          error: true,
          message: options.message,
        });
        return;
      }
      res.status(options.statusCode).send(options.message);
    },
    ...options,
  });
}

export interface PrismaStoreOptions {
  /**
   * Optional field to differentiate hit counts when multiple rate-limits are in use
   */
  prefix?: string;

  /**
   * How often to clean up expired entries (in milliseconds)
   * @default 60_000 (1 minute)
   */
  cleanupIntervalMs?: number;
}

/**
 * A Prisma-backed Store implementation for express-rate-limit.
 * Stores rate limit data in a postgres table with optimized queries for performance.
 *
 * @public
 */
export class PrismaRateLimitStore implements Store {
  localKeys = false;
  prefix: string;
  windowMs!: number;

  /**
   * Interval for cleanup of expired entries
   */
  private cleanupIntervalMs: number;

  /**
   * Timer reference for cleanup interval
   */
  private cleanupTimer?: NodeJS.Timeout;

  constructor(options: PrismaStoreOptions = {}) {
    this.prefix = options.prefix ?? 'rl:';
    this.cleanupIntervalMs = options.cleanupIntervalMs ?? 60_000;
  }

  init(options: Options): void {
    this.windowMs = options.windowMs;

    // Start cleanup interval to remove expired entries
    this.startCleanup();
  }

  /**
   * Method to prefix the keys with the given text.
   *
   * @param key {string} - The key.
   *
   * @returns {string} - The prefixed key.
   *
   * @private
   */
  private prefixKey(key: string): string {
    return `${this.prefix}${key}`;
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const prefixedKey = this.prefixKey(key);

    try {
      const row = await prisma.rateLimit.findUnique({
        where: { key: prefixedKey },
      });

      if (!row) {
        return undefined;
      }

      const now = new Date();
      const resetTime = row.resetTime;

      // If the reset time has passed, this entry is expired
      if (resetTime <= now) {
        return undefined;
      }

      return {
        totalHits: row.hits,
        resetTime,
      };
    } catch (error) {
      logger.error(getExceptionLog(error), `[RATE_LIMIT][GET] Error fetching rate limit for key: ${prefixedKey}`);
      throw error;
    }
  }

  async increment(key: string): Promise<IncrementResponse> {
    const prefixedKey = this.prefixKey(key);
    const now = new Date();
    const resetTime = new Date(now.getTime() + this.windowMs);

    try {
      // Use an atomic upsert (INSERT ... ON CONFLICT) for optimal performance
      // If the key exists and hasn't expired, increment the counter
      // If the key doesn't exist or has expired, create/reset with count of 1
      const row = await prisma.rateLimit.upsert({
        where: { key: prefixedKey },
        select: { hits: true, resetTime: true },
        update: {
          hits: { increment: 1 },
          resetTime,
          updatedAt: now,
        },
        create: {
          key: prefixedKey,
          hits: 1,
          resetTime,
          createdAt: now,
          updatedAt: now,
        },
      });

      return {
        totalHits: row.hits,
        resetTime: row.resetTime,
      };
    } catch (error) {
      logger.error(getExceptionLog(error), `[RATE_LIMIT][INCREMENT] Error incrementing rate limit for key: ${prefixedKey}`);
      throw error;
    }
  }

  async decrement(key: string): Promise<void> {
    const prefixedKey = this.prefixKey(key);
    const now = new Date();

    try {
      // Only decrement if the entry exists and hasn't expired
      // Don't let hits go below 0
      await prisma.rateLimit.updateMany({
        where: { key: prefixedKey, resetTime: { gt: now } },
        data: {
          hits: { decrement: 1 },
          updatedAt: now,
        },
      });
    } catch (error) {
      logger.error(getExceptionLog(error), `[RATE_LIMIT][DECREMENT] Error decrementing rate limit for key: ${prefixedKey}`);
      throw error;
    }
  }

  async resetKey(key: string): Promise<void> {
    const prefixedKey = this.prefixKey(key);

    try {
      await prisma.rateLimit.delete({
        where: { key: prefixedKey },
      });
    } catch (error) {
      logger.error(getExceptionLog(error), `[RATE_LIMIT][RESET_KEY] Error resetting rate limit for key: ${prefixedKey}`);
      throw error;
    }
  }

  async resetAll(): Promise<void> {
    try {
      // Only reset entries with the current prefix to avoid affecting other rate limiters
      await prisma.rateLimit.deleteMany({
        where: {
          key: { startsWith: this.prefix },
        },
      });
    } catch (error) {
      logger.error(getExceptionLog(error), `[RATE_LIMIT][RESET_ALL] Error resetting all rate limits for prefix: ${this.prefix}`);
      throw error;
    }
  }

  /**
   * Starts the cleanup interval to periodically remove expired entries.
   *
   * @private
   */
  private startCleanup(): void {
    // Clear any existing timer
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    // Run cleanup periodically
    this.cleanupTimer = setInterval(() => {
      this.cleanup().catch((error) => {
        logger.error(getExceptionLog(error), '[RATE_LIMIT][CLEANUP] Error during cleanup interval');
      });
    }, this.cleanupIntervalMs);

    // Don't prevent the process from exiting
    this.cleanupTimer.unref();
  }

  /**
   * Removes expired entries from the database to keep the table size manageable.
   *
   * @private
   */
  private async cleanup(): Promise<void> {
    const now = new Date();

    try {
      await prisma.rateLimit.deleteMany({
        where: {
          resetTime: { lte: now },
        },
      });
    } catch (error) {
      logger.error(getExceptionLog(error), '[RATE_LIMIT][CLEANUP] Error removing expired entries');
      // Don't throw - cleanup failures shouldn't affect rate limiting
    }
  }

  /**
   * Stops the cleanup interval. Call this when shutting down the application.
   *
   * @public
   */
  shutdown(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }
}
