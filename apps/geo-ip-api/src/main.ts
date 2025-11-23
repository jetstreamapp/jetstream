import { ENV, getExceptionLog, httpLogger, logger } from '@jetstream/api-config';
import { json, urlencoded } from 'body-parser';
import express from 'express';
import { z, ZodError } from 'zod';
import { downloadMaxMindDb, initMaxMind, lookupIpAddress, validateIpAddress } from './maxmind.service';
import { createRoute } from './route.utils';

const DISK_PATH = process.env.DISK_PATH ?? __dirname;

if (ENV.ENVIRONMENT !== 'development' && (!ENV.GEO_IP_API_USERNAME || !ENV.GEO_IP_API_PASSWORD)) {
  logger.error('GEO_IP_API_USERNAME/GEO_IP_API_PASSWORD environment variables are not set');
  process.exit(1);
}

const app = express();

app.use(json({ limit: '20mb' }));
app.use(urlencoded({ extended: true }));

app.use(httpLogger);

app.use('/healthz', (_, res) => {
  res.status(200).json({
    error: false,
    uptime: process.uptime(),
    message: 'Healthy',
  });
});

app.use((req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (typeof authHeader !== 'string') {
      throw new Error('Unauthorized');
    }
    const [type, token] = authHeader.split(' ');
    if (type !== 'Basic') {
      throw new Error('Unauthorized');
    }
    const [username, password] = Buffer.from(token, 'base64').toString().split(':');
    if (username !== ENV.GEO_IP_API_USERNAME || password !== ENV.GEO_IP_API_PASSWORD) {
      throw new Error('Unauthorized');
    }
    next();
  } catch {
    res.header('WWW-Authenticate', 'Basic realm="Geo IP API"');
    res.status(401).json({
      success: false,
      message: 'Unauthorized',
    });
  }
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
      res.log.error(getExceptionLog(ex, true), 'Failed to download MaxMind database');
      next(ex);
    }
  }),
);

/**
 * Lookup a single IP address
 */
app.get(
  '/api/lookup',
  createRoute({ query: z.object({ ip: z.string() }) }, async ({ query }, _, res, next) => {
    try {
      const ipAddress = query.ip;
      await initMaxMind(DISK_PATH);
      if (!validateIpAddress(ipAddress)) {
        res.status(400).json({ success: false, message: 'IP address is invalid' });
        return;
      }
      const results = lookupIpAddress(ipAddress);
      res.status(200).json({ success: true, results });
    } catch (ex) {
      res.log.error(getExceptionLog(ex, true), 'Failed to lookup IP address');
      next(ex);
    }
  }),
);

/**
 * Lookup multiple IP addresses
 */
app.post(
  '/api/lookup',
  createRoute({ body: z.object({ ips: z.string().array() }) }, async ({ body }, _, res, next) => {
    try {
      const ipAddresses = body.ips;
      await initMaxMind(DISK_PATH);

      const results = ipAddresses.map((ipAddress) => {
        const isValid = validateIpAddress(ipAddress);
        return {
          ipAddress,
          isValid,
          ...(isValid ? lookupIpAddress(ipAddress) : null),
        };
      });

      res.status(200).json({ success: true, results });
    } catch (ex) {
      res.log.error(getExceptionLog(ex, true), 'Failed to lookup IP address');
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

app.use((err: Error | ZodError, _: express.Request, res: express.Response) => {
  res.log.error({ ...getExceptionLog(err) }, 'Unhandled error');

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
  logger.error(getExceptionLog(error, true), 'Server error: %s', error.message);
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
