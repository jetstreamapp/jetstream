// Must be first: initializes Sentry, validates the shared env and connects the database
import '@jetstream/api-config';

import { httpLogger, logger, requestContextMiddleware } from '@jetstream/api-config';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { authRoutes } from './app/auth/auth.routes';
import { createCloudflareAccessMiddleware } from './app/auth/cloudflare-access';
import { ADMIN_ENV } from './app/config/admin-env.config';
import { apiRoutes } from './app/routes/api.routes';
import { errorHandler, notFoundHandler } from './app/utils/error-handler';

/** The SPA build output (dist/apps/admin) sits next to this bundle (dist/apps/admin-api) */
const SPA_DIRECTORY = join(__dirname, '../admin');
const SPA_INDEX_FILE = join(SPA_DIRECTORY, 'index.html');

const app = express();

app.disable('x-powered-by');
// Resolves the client IP and protocol behind Render's load balancer
app.set('trust proxy', 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        'default-src': ["'self'"],
        'script-src': ["'self'"],
        'connect-src': ["'self'"],
        // Google profile photos
        'img-src': ["'self'", 'data:', 'https://*.googleusercontent.com'],
        'frame-ancestors': ["'none'"],
        'form-action': ["'self'"],
        'upgrade-insecure-requests': ADMIN_ENV.useSecureCookies ? [] : null,
      },
    },
    strictTransportSecurity: ADMIN_ENV.useSecureCookies,
  }),
);

app.use((_, res, next) => {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  next();
});

// Before the Cloudflare Access check: Render's health checks reach the service directly
app.get('/healthz', (_, res) => {
  res.status(200).json({ error: false, uptime: process.uptime(), message: 'Healthy' });
});

const cloudflareAccessMiddleware = createCloudflareAccessMiddleware();
if (cloudflareAccessMiddleware) {
  app.use(cloudflareAccessMiddleware);
}

app.use(httpLogger);
app.use(requestContextMiddleware);
app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));

app.use('/auth', authRoutes);
app.use('/api', apiRoutes);
app.use('/api', notFoundHandler);

// In development the Vite dev server serves the SPA; in production this bundle serves the build
if (existsSync(SPA_INDEX_FILE)) {
  app.use('/assets', express.static(join(SPA_DIRECTORY, 'assets'), { immutable: true, maxAge: '1y', fallthrough: false }));
  app.use(express.static(SPA_DIRECTORY, { index: false }));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/auth/')) {
      next();
      return;
    }
    res.setHeader('Cache-Control', 'no-store');
    // Relative to `root` so `send` only applies its dotfile rules to `index.html`, not to the deploy path
    res.sendFile('index.html', { root: SPA_DIRECTORY });
  });
}

app.use(notFoundHandler);
app.use(errorHandler);

const server = app.listen(ADMIN_ENV.ADMIN_API_PORT, () => {
  logger.info(
    { baseUrl: ADMIN_ENV.ADMIN_BASE_URL, cloudflareAccess: ADMIN_ENV.cloudflareAccessEnabled },
    `[ADMIN] Listening on port ${ADMIN_ENV.ADMIN_API_PORT}`,
  );
});

// A listen failure (port in use, permission denied) leaves a process that serves nothing; exit so the
// platform restarts it instead of reporting it healthy
server.on('error', (error) => {
  logger.error({ err: error }, '[ADMIN] Server error: %s', error.message);
  process.exit(1);
});

process.on('SIGTERM', () => {
  logger.info('[ADMIN] SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('[ADMIN] Server closed');
    process.exit(0);
  });

  setTimeout(() => {
    logger.error('[ADMIN] Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 30_000);
});
