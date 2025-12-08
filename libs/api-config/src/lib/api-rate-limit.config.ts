import { ClusterMemoryStoreWorker } from '@express-rate-limit/cluster-memory-store';
import { HTTP } from '@jetstream/shared/constants';
import cluster from 'cluster';
import { MemoryStore, Options, rateLimit } from 'express-rate-limit';

export function createRateLimit(prefix: string, options: Partial<Options>) {
  return rateLimit({
    // cluster.isPrimary will be true on development and production master process
    store: cluster.isPrimary
      ? new MemoryStore()
      : new ClusterMemoryStoreWorker({
          prefix,
        }),
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
