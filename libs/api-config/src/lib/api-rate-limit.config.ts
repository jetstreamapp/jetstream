import { ClusterMemoryStoreWorker } from '@express-rate-limit/cluster-memory-store';
import { HTTP } from '@jetstream/shared/constants';
import cluster from 'cluster';
import { MemoryStore, Options, rateLimit, Store } from 'express-rate-limit';
import { logger } from './api-logger';
import { errorTracker } from './api-sentry-config';
import { PgRateLimitStore } from './pg-rate-limit-store';

// Each ClusterMemoryStoreWorker instance attaches a `message` listener to cluster.worker
// on init. Increase the limit for some breathing room
if (!cluster.isPrimary && cluster.worker) {
  cluster.worker.setMaxListeners(Math.max(cluster.worker.getMaxListeners(), 24));
}

// When a distributed limiter's backing store errors, `passOnStoreError` lets the request through
// (fail OPEN) — a security-relevant degradation. express-rate-limit reports that via its `logger`
// (default ConsoleLogger -> unstructured console.error). This adapter routes it to the app's pino
// logger AND errorTracker so the fail-open is alertable, throttled so a sustained DB outage can't
// flood logs/Sentry (one signal per minute per process is enough to page on).
const STORE_ERROR_LOG_THROTTLE_MS = 1000 * 60;
let lastStoreErrorLoggedAt = 0;
const rateLimitStoreLogger = {
  error: (...args: unknown[]) => {
    const now = Date.now();
    if (now - lastStoreErrorLoggedAt < STORE_ERROR_LOG_THROTTLE_MS) {
      return;
    }
    lastStoreErrorLoggedAt = now;
    const err = args[0];
    logger.error({ err }, '[RATE_LIMIT][STORE] backing store error — limiter is FAILING OPEN (requests allowed without throttling)');
    errorTracker.warn(err instanceof Error ? err : '[RATE_LIMIT] backing store error — limiter failing open');
  },
  warn: (...args: unknown[]) => {
    logger.warn({ args }, '[RATE_LIMIT] store warning');
  },
};

/**
 * @param distributed When true, use the Postgres-backed store so the limit is enforced across ALL
 *   instances/containers (not just one host's worker pool). Reserve for security-sensitive limiters
 *   (auth, password reset, openapi); leave high-volume cosmetic limiters (SPA, assets) on the
 *   in-memory cluster store. Distributed limiters fail OPEN on a DB error (`passOnStoreError`).
 */
export function createRateLimit(prefix: string, options: Partial<Options>, { distributed = false }: { distributed?: boolean } = {}) {
  // cluster.isPrimary will be true on development and production master process
  const clusterStore: Store = cluster.isPrimary ? new MemoryStore() : new ClusterMemoryStoreWorker({ prefix });
  return rateLimit({
    store: distributed ? new PgRateLimitStore({ prefix: `${prefix}:` }) : clusterStore,
    // A DB hiccup must not throw on every request — fail open for the distributed store.
    passOnStoreError: distributed,
    // Route the fail-open store-error log to pino + errorTracker (instead of the default console).
    ...(distributed ? { logger: rateLimitStoreLogger } : {}),
    windowMs: 1000 * 60 * 1, // 1 minute
    limit: 100, // limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    handler: (req, res, next, options) => {
      logger.warn({ ip: req.ip, path: req.path, method: req.method, prefix }, '[RATE_LIMIT] Request rate limit exceeded');
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
