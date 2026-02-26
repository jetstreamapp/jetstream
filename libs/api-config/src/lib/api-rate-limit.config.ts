import { ClusterMemoryStoreWorker } from '@express-rate-limit/cluster-memory-store';
import { HTTP } from '@jetstream/shared/constants';
import cluster from 'cluster';
import { MemoryStore, Options, rateLimit } from 'express-rate-limit';
import { logger } from './api-logger';

export function createRateLimit(prefix: string, options: Partial<Options>) {
  return rateLimit({
    // cluster.isPrimary will be true on development and production master process
    store: cluster.isPrimary
      ? new MemoryStore()
      : new ClusterMemoryStoreWorker({
          prefix,
        }),
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
