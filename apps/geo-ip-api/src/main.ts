import {
  createRateLimit,
  ENV,
  getLogger,
  httpLogger,
  installProcessErrorHandlers,
  logger,
  requestContextMiddleware,
} from '@jetstream/api-config';
import { GeoIpLookupResult } from '@jetstream/types';
import { json } from 'body-parser';
import express from 'express';
import { z, ZodError } from 'zod';
import { hasValidBasicAuthCredentials } from './basic-auth';
import { downloadMaxMindDb, initMaxMind, lookupIpAddress, validateIpAddress } from './maxmind.service';
import { createRoute } from './route.utils';

installProcessErrorHandlers();

const DISK_PATH = process.env.DISK_PATH ?? __dirname;

if (ENV.ENVIRONMENT !== 'development' && (!ENV.GEO_IP_API_USERNAME || !ENV.GEO_IP_API_PASSWORD)) {
  logger.error('GEO_IP_API_USERNAME/GEO_IP_API_PASSWORD environment variables are not set');
  process.exit(1);
}

/**
 * The only request body is a lookup batch of at most 1000 IP strings (about 50 KB), parsed per route and only
 * after the request is authenticated.
 */
const LOOKUP_BODY_LIMIT = '256kb';
/** Longer than any textual IPv4 or IPv6 address, including a zone index. */
const MAX_IP_ADDRESS_LENGTH = 100;

const app = express();

app.use(httpLogger);
app.use(requestContextMiddleware);

app.use('/healthz', (_, res) => {
  res.status(200).json({
    error: false,
    uptime: process.uptime(),
    message: 'Healthy',
  });
});

const hasValidCredentials = (req: express.Request) =>
  hasValidBasicAuthCredentials(req.headers.authorization, ENV.GEO_IP_API_USERNAME, ENV.GEO_IP_API_PASSWORD);

// Throttles requests without valid credentials. Authenticated callers skip the limiter entirely, so a flood of bad
// requests can never use up the limit of the services that call this one. It keys on the connecting address (this
// app does not trust proxy headers), which may be a shared proxy address; that only groups unauthenticated callers.
app.use(
  createRateLimit('geo_ip_unauthenticated', {
    windowMs: 1000 * 60 * 1, // 1 minute
    limit: 30,
    skip: hasValidCredentials,
    validate: { xForwardedForHeader: false },
  }),
);

app.use((req, res, next) => {
  if (hasValidCredentials(req)) {
    next();
    return;
  }
  res.header('WWW-Authenticate', 'Basic realm="Geo IP API"');
  res.status(401).json({
    success: false,
    message: 'Unauthorized',
  });
});

app.post(
  '/api/download',
  createRoute({}, async (_, __, res, next) => {
    try {
      const startTime = Date.now();
      await downloadMaxMindDb(DISK_PATH);
      const timeTaken = Date.now() - startTime;
      res.status(200).json({
        success: true,
        message: 'MaxMind database downloaded',
        timeTaken,
      });
    } catch (ex) {
      getLogger().error({ err: ex }, 'Failed to download MaxMind database');
      next(ex);
    }
  }),
);

/**
 * Lookup a single IP address
 */
app.get(
  '/api/lookup',
  createRoute({ query: z.object({ ip: z.string().max(MAX_IP_ADDRESS_LENGTH) }) }, async ({ query }, _, res, next) => {
    try {
      const ipAddress = query.ip;
      await initMaxMind(DISK_PATH);
      if (!validateIpAddress(ipAddress)) {
        res.status(400).json({ success: false, message: 'IP address is invalid' });
        return;
      }
      const geoData = lookupIpAddress(ipAddress);
      const result: GeoIpLookupResult = geoData
        ? { ipAddress, isValid: true as const, ...geoData }
        : { ipAddress, isValid: false as const };
      res.status(200).json({ success: true, results: [result] });
    } catch (ex) {
      getLogger().error({ err: ex }, 'Failed to lookup IP address');
      next(ex);
    }
  }),
);

/**
 * Lookup multiple IP addresses
 */
app.post(
  '/api/lookup',
  json({ limit: LOOKUP_BODY_LIMIT, inflate: false }),
  createRoute({ body: z.object({ ips: z.string().max(MAX_IP_ADDRESS_LENGTH).array().max(1000) }) }, async ({ body }, _, res, next) => {
    try {
      const ipAddresses = body.ips;
      await initMaxMind(DISK_PATH);

      const results: GeoIpLookupResult[] = ipAddresses.map((ipAddress) => {
        if (!validateIpAddress(ipAddress)) {
          return { ipAddress, isValid: false as const };
        }
        const geoData = lookupIpAddress(ipAddress);
        if (!geoData) {
          return { ipAddress, isValid: false as const };
        }
        return { ipAddress, isValid: true as const, ...geoData };
      });

      res.status(200).json({ success: true, results });
    } catch (ex) {
      getLogger().error({ err: ex }, 'Failed to lookup IP address');
      next(ex);
    }
  }),
);

app.use((_, res) => {
  res.status(404).json({
    success: false,
    message: 'Not found',
  });
});

app.use((err: Error | ZodError, _: express.Request, res: express.Response, _next: express.NextFunction) => {
  getLogger().error({ err }, 'Unhandled error');

  if (err instanceof ZodError) {
    res.status(400);
    res.json({
      success: false,
      message: 'Validation error',
      details: z.treeifyError(err),
    });
    return;
  }

  if (!res.statusCode || res.statusCode < 400) {
    res.status(500);
  }

  res.json({
    success: false,
    message: err.message,
  });
});

const port = Number(process.env.PORT || 3334);

const server = app.listen(port, () => {
  logger.info(`Listening at http://localhost:${port}/api`);
});

server.on('error', (error) => {
  logger.error({ err: error }, 'Server error: %s', error.message);
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });

  // Force close after 30s
  setTimeout(() => {
    logger.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30_000);
});
