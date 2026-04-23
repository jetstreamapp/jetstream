// this gets imported first to ensure some items that require early initialization run first
import '@jetstream/api-config';

import { ClusterMemoryStorePrimary } from '@express-rate-limit/cluster-memory-store';
import { createRateLimit, ENV, httpLogger, logger, pgPool, sentryRequestContextMiddleware } from '@jetstream/api-config';
import '@jetstream/auth/types';
import { HTTP, SESSION_EXP_DAYS } from '@jetstream/shared/constants';
import { setupPrimary } from '@socket.io/cluster-adapter';
import { setupMaster } from '@socket.io/sticky';
import { json, raw, urlencoded } from 'body-parser';
import pgSimple from 'connect-pg-simple';
import cors from 'cors';
import express from 'express';
import proxy from 'express-http-proxy';
import session from 'express-session';
import helmet from 'helmet';
import cluster from 'node:cluster';
import { readFileSync } from 'node:fs';
import http from 'node:http';
import { cpus } from 'node:os';
import { join, posix as pathPosix } from 'node:path';
import { initSocketServer } from './app/controllers/socket.controller';
import {
  apiRoutes,
  authRoutes,
  billingRoutes,
  canvasRoutes,
  desktopAppRoutes,
  desktopAssetsRoutes,
  oauthRoutes,
  openApiRoutes,
  platformEventRoutes,
  redirectRoutes,
  scannerRoutes,
  staticAuthenticatedRoutes,
  teamRoutes,
  testRoutes,
  webExtensionRoutes,
  webhookRoutes,
} from './app/routes';
import {
  addContextMiddleware,
  destroySessionIfPendingVerificationIsExpired,
  notFoundMiddleware,
  redirectIfMfaEnrollmentRequiredMiddleware,
  redirectIfNotAuthenticatedMiddleware,
  redirectIfPendingTosAcceptanceMiddleware,
  redirectIfPendingVerificationMiddleware,
  setCacheControlForApiRoutes,
  setPermissionPolicy,
} from './app/routes/route.middleware';
import { healthCheck, uncaughtErrorHandler } from './app/utils/response.handlers';
import { buildCspDirectives, buildHstsConfig } from './app/utils/security-headers';
import { handleWorkerExit, primaryClusterInitSideEffects, shutdownPrimaryGracefully } from './app/utils/server-process.utils';
import { environment } from './environments/environment';

// NOTE: render reports more CPUs than are actually available
const CPU_COUNT = Math.min(cpus().length, 3);

if (cluster.isPrimary) {
  primaryClusterInitSideEffects();
}

if (ENV.NODE_ENV === 'production' && !ENV.CI && cluster.isPrimary) {
  logger.info(`Number of CPUs is ${CPU_COUNT}`);
  logger.info(`Master ${process.pid} is running`);

  // Setup socket.io sticky session for cluster, uses sid parameter to route to the same worker on each request
  const socketIoClusterRouterServer = http.createServer();
  setupMaster(socketIoClusterRouterServer, {
    loadBalancingMethod: 'least-connection', // either "random", "round-robin" or "least-connection"
  });

  setupPrimary();

  const rateLimiterStore = new ClusterMemoryStorePrimary();
  rateLimiterStore.init();

  for (let i = 0; i < CPU_COUNT; i++) {
    cluster.fork();
  }

  // Respawn dead workers with exponential backoff to avoid tight fork loops on
  // startup crashes (bad env, DB unreachable). Exits the primary after too many
  // consecutive rapid failures so Render can replace the container.
  cluster.on('exit', handleWorkerExit);

  // Forward SIGTERM to workers and wait for them to exit cleanly before the primary
  // exits. Each worker has its own SIGTERM handler that drains the pg pool.
  process.on('SIGTERM', () => shutdownPrimaryGracefully());
} else {
  logger.info(`Worker ${process.pid} started`);

  const pgSession = pgSimple(session);

  const sessionMiddleware = session({
    store: new pgSession({
      pool: pgPool,
      tableName: 'sessions',
    }),
    cookie: {
      path: '/',
      secure: ENV.USE_SECURE_COOKIES,
      // Set to two - if you don't login for 48 hours, then expire session - consider changing to 1
      maxAge: 1000 * 60 * 60 * 24 * SESSION_EXP_DAYS,
      httpOnly: true,
      sameSite: 'lax',
    },
    // If previous key is provided, include both to allow for key rotation
    secret: ENV.JETSTREAM_SESSION_SECRET_PREV
      ? [ENV.JETSTREAM_SESSION_SECRET, ENV.JETSTREAM_SESSION_SECRET_PREV]
      : ENV.JETSTREAM_SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    // This will extend the cookie expiration date if there is a request of any kind to a logged in user
    rolling: true,
    name: 'sessionid',
  });

  const app = express();
  const httpServer = initSocketServer(app, { sessionMiddleware });

  if (environment.production) {
    app.set('trust proxy', 1); // required for environments such as heroku / {render?}
  }

  app.use(addContextMiddleware);

  // Setup session
  app.use(sessionMiddleware);

  // Stamp user/IP/URL onto Sentry's isolation scope so any error captured during
  // this request — including from services that don't receive `req` — carries full context.
  app.use(sentryRequestContextMiddleware);

  // `crossOriginOpenerPolicy: false` is load-bearing. Any COOP value — including the
  // looser `same-origin-allow-popups` — causes the browser to isolate popups into a new
  // browsing-context group when they navigate cross-origin, and the opener reference is
  // never restored when they navigate back. That breaks the Salesforce OAuth popup flow
  // in apps/landing/pages/oauth-link/index.tsx which reads window.opener after
  // Jetstream → Salesforce → /oauth-link, plus Google Picker OAuth consent and any other
  // popup-based third-party auth.
  app.use(
    helmet({
      contentSecurityPolicy: { directives: buildCspDirectives() },
      crossOriginOpenerPolicy: false,
      hsts: buildHstsConfig(),
    }),
  );

  app.use(setPermissionPolicy);

  if (ENV.ENVIRONMENT === 'development') {
    app.use('/analytics', cors({ origin: /http:\/\/localhost:[0-9]+$/ }), (_, res) => res.status(200).send('success'));
  } else {
    app.use(
      '/analytics',
      proxy('https://api2.amplitude.com', {
        proxyReqPathResolver: (req) => req.originalUrl.replace('/analytics', '/2/httpapi'),
      }),
    );
  }

  app.use(httpLogger);

  // Handle CORS for web extension routes
  const allowedHeaders = [
    HTTP.HEADERS.ACCEPT,
    HTTP.HEADERS.CONTENT_TYPE,
    HTTP.HEADERS.AUTHORIZATION,
    HTTP.HEADERS.X_EXT_DEVICE_ID,
    HTTP.HEADERS.X_WEB_EXTENSION_DEVICE_ID,
    HTTP.HEADERS.X_SUPPORTS_TOKEN_ROTATION,
    HTTP.HEADERS.X_APP_VERSION,
  ].join(', ');
  app.use('/web-extension/*splat', (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (
      (ENV.WEB_EXTENSION_ID_CHROME && req.headers.origin === `chrome-extension://${ENV.WEB_EXTENSION_ID_CHROME}`) ||
      (ENV.WEB_EXTENSION_ID_MOZILLA && req.headers.origin === `moz-extension://${ENV.WEB_EXTENSION_ID_MOZILLA}`)
    ) {
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', allowedHeaders);
    }
    next();
  });

  app.options('/web-extension/*splat', (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (
      (ENV.WEB_EXTENSION_ID_CHROME && req.headers.origin === `chrome-extension://${ENV.WEB_EXTENSION_ID_CHROME}`) ||
      (ENV.WEB_EXTENSION_ID_MOZILLA && req.headers.origin === `moz-extension://${ENV.WEB_EXTENSION_ID_MOZILLA}`)
    ) {
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', allowedHeaders);
      res.sendStatus(200);
      return;
    }
    next();
  });

  // proxy must be provided prior to body parser to ensure streaming response
  if (ENV.ENVIRONMENT === 'development') {
    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (req.headers.origin?.includes('localhost')) {
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader(
          'Access-Control-Expose-Headers',
          [
            'BAYEUX_BROWSER',
            HTTP.HEADERS.X_LOGOUT,
            HTTP.HEADERS.X_LOGOUT_URL,
            HTTP.HEADERS.X_SFDC_ID,
            HTTP.HEADERS.X_SFDC_API_VERSION,
            HTTP.HEADERS.X_SFDC_ID_TARGET,
            HTTP.HEADERS.X_SFDC_API_TARGET_VERSION,
            HTTP.HEADERS.X_SFDC_ORG_CONNECTION_ERROR,
            HTTP.HEADERS.X_SFDC_Session,
            HTTP.HEADERS.X_INCLUDE_CALL_OPTIONS,
            HTTP.HEADERS.X_CACHE_RESPONSE,
            HTTP.HEADERS.X_CACHE_KEY,
            HTTP.HEADERS.X_CACHE_AGE,
            HTTP.HEADERS.X_CACHE_EXP,
          ].join(', '),
        );
      }
      next();
    });
    app.options(
      '/{*splat}',
      cors({
        origin: true,
        credentials: true,
        exposedHeaders: [
          'BAYEUX_BROWSER',
          HTTP.HEADERS.X_LOGOUT,
          HTTP.HEADERS.X_LOGOUT_URL,
          HTTP.HEADERS.X_SFDC_ID,
          HTTP.HEADERS.X_SFDC_API_VERSION,
          HTTP.HEADERS.X_SFDC_ID_TARGET,
          HTTP.HEADERS.X_SFDC_API_TARGET_VERSION,
          HTTP.HEADERS.X_SFDC_ORG_CONNECTION_ERROR,
          HTTP.HEADERS.X_SFDC_Session,
          HTTP.HEADERS.X_INCLUDE_CALL_OPTIONS,
          HTTP.HEADERS.X_CACHE_RESPONSE,
          HTTP.HEADERS.X_CACHE_KEY,
          HTTP.HEADERS.X_CACHE_AGE,
          HTTP.HEADERS.X_CACHE_EXP,
        ],
      }),
    );
    app.use('/platform-event', cors({ origin: /http:\/\/localhost:[0-9]+$/ }), platformEventRoutes);
  } else {
    // This must come before body parser to ensure that the raw body is available to be streamed to Salesforce
    app.use('/platform-event', platformEventRoutes);
  }

  app.use('/webhook', webhookRoutes);

  app.use(raw({ limit: '30mb', type: ['text/csv'] }));
  app.use(raw({ limit: '30mb', type: ['application/zip'] }));
  app.use(json({ limit: '20mb', type: ['json', 'application/csp-report'] }));
  app.use(urlencoded({ extended: true }));

  // Must run after sessionMiddleware (which loads req.session) and before any route handler,
  // so an expired pending-verification session is destroyed before a route can observe it.
  // Placement here — after body parsers, just before the route mounts — is intentional.
  app.use(destroySessionIfPendingVerificationIsExpired);

  app.use('/healthz', setCacheControlForApiRoutes, healthCheck);
  app.use('/redirect', setCacheControlForApiRoutes, redirectRoutes);
  // Automated-scanner bootstrap — self-gated (TEST_ENABLE_SCANNER_ROUTES + non-prod server URL + basic auth)
  // Mounted before /api so it bypasses checkAuth / validateDoubleCSRF, which is the whole point
  // (it has to run before a session exists). See apps/api/src/app/routes/scanner.routes.ts.
  app.use('/api/test/scanner', setCacheControlForApiRoutes, scannerRoutes);
  app.use('/api/auth', setCacheControlForApiRoutes, authRoutes);
  app.use('/api/teams', setCacheControlForApiRoutes, teamRoutes);
  app.use('/api/billing', setCacheControlForApiRoutes, billingRoutes);
  app.use('/api', setCacheControlForApiRoutes, apiRoutes);
  app.use('/desktop-assets', desktopAssetsRoutes);
  app.use('/static', setCacheControlForApiRoutes, staticAuthenticatedRoutes); // these are routes that return files or redirect (e.x. NOT JSON)
  app.use('/oauth', setCacheControlForApiRoutes, oauthRoutes); // NOTE: there are also static files with same path
  app.use('/web-extension', setCacheControlForApiRoutes, webExtensionRoutes);
  app.use('/desktop-app', setCacheControlForApiRoutes, desktopAppRoutes);
  app.use('/openapi', setCacheControlForApiRoutes, openApiRoutes);
  app.use('/canvas', canvasRoutes);

  if (ENV.ENVIRONMENT !== 'production' || ENV.CI) {
    app.use('/test', testRoutes);
  }

  if (!environment.production) {
    app.use(cors({ origin: /http:\/\/localhost:[0-9]+$/ }));
  }

  // Helmet v8 sets Cross-Origin-Resource-Policy: same-origin globally, which is what
  // the previous per-mount setCrossOriginResourcePolicy middleware was doing for
  // static assets. No extra per-route middleware needed here.
  app.use('/assets/js/monaco/vs', express.static(join(__dirname, '../../../node_modules/monaco-editor/min/vs')));
  app.use('/.well-known', express.static(join(__dirname, './assets/.well-known')));
  app.use('/assets', express.static(join(__dirname, './assets'), { maxAge: '1m' }));
  app.use('/fonts', express.static(join(__dirname, './assets/fonts')));
  app.use(express.static(join(__dirname, '../landing')));

  // Load the landing site's 404 page so uncaughtErrorHandler can serve it inline
  // with a real 404 status (instead of redirecting to /404/, which logged as 302
  // and masked which URLs were actually missing). Next.js export emits either
  // `404/index.html` (trailingSlash) or `404.html` depending on build config.
  let notFoundHtml: string | null = null;
  try {
    notFoundHtml = readFileSync(join(__dirname, '../landing/404/index.html'), 'utf8');
  } catch {
    try {
      notFoundHtml = readFileSync(join(__dirname, '../landing/404.html'), 'utf8');
    } catch (error) {
      logger.error({ err: error }, '[404] Failed to read landing 404 page — 404 responses will fall back to plain text');
    }
  }
  app.locals.notFoundHtml = notFoundHtml;

  if (environment.production || ENV.CI || ENV.JETSTREAM_CLIENT_URL.replace('/app', '') === ENV.JETSTREAM_SERVER_URL) {
    // Rate limiter for SPA entry point - lenient to allow frequent refreshes and asset loading
    // Most assets should be cached at the edge, so this generally should not matter
    const spaRateLimit = createRateLimit('spa', {
      windowMs: 1000 * 60 * 1, // 1 minute
      limit: ENV.CI || ENV.ENVIRONMENT === 'development' ? 10000 : 100, // 100 requests per minute per IP
    });
    // Read the SPA shell once; we substitute the CSP nonce per request. On failure
    // (partial deploy, missing build) we log and fall back to a 503 scoped to /app —
    // throwing here would crash the worker and take down /healthz, /api, webhooks too.
    let jetstreamIndexHtml: string | null = null;
    try {
      jetstreamIndexHtml = readFileSync(join(__dirname, '../jetstream/index.html'), 'utf8');
    } catch (error) {
      logger.error(
        { err: error },
        '[SPA] Failed to read jetstream/index.html at startup — /app will return 503 until a valid build is available',
      );
    }

    // Serve the SPA's built assets, but never `index.html` — it contains unreplaced
    // `__CSP_NONCE__` placeholders and must only be sent through the /app handler below.
    // `{ index: false }` disables directory→index.html mapping; the guard after catches
    // direct index.html requests regardless of encoding.
    const jetstreamStatic = express.static(join(__dirname, '../jetstream'), { index: false });
    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      // Must mirror send's own path transform (decode → collapse slash runs → normalize
      // dot segments) or the guard is bypassable. `req.path` from parseurl is raw —
      // it doesn't decode `%2f`, doesn't collapse `//`, and doesn't resolve `.`/`..` —
      // while `send` inside express.static does all three and would happily serve
      // <root>/index.html for e.g. `//index.html`, `/%2findex.html`, or `/foo/%2e%2e/index.html`.
      let decodedPath: string;
      try {
        decodedPath = decodeURIComponent(req.path);
      } catch {
        // Malformed percent-encoding — let downstream 404 handle it.
        return next();
      }
      const normalizedPath = pathPosix.normalize(decodedPath.replace(/\/+/g, '/'));
      if (normalizedPath === '/index.html') {
        return next();
      }
      jetstreamStatic(req, res, next);
    });
    app.use(
      '/app',
      spaRateLimit,
      redirectIfPendingVerificationMiddleware,
      redirectIfPendingTosAcceptanceMiddleware,
      redirectIfMfaEnrollmentRequiredMiddleware,
      redirectIfNotAuthenticatedMiddleware,
      helmet.contentSecurityPolicy({
        directives: buildCspDirectives(['https://*.google.com', 'https://*.googleusercontent.com', 'https://accounts.google.com']),
      }),
      (_: express.Request, res: express.Response) => {
        if (!jetstreamIndexHtml) {
          res.status(503);
          res.setHeader('Content-Type', 'text/plain; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.setHeader('Retry-After', '30');
          res.send('Jetstream is temporarily unavailable — the application build is not ready. Please try again shortly.');
          return;
        }
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-store');
        res.send(jetstreamIndexHtml.replaceAll('__CSP_NONCE__', res.locals.cspNonce));
      },
    );
  }

  // Catch-all 404 handler (no path => matches all)
  app.use(notFoundMiddleware);
  app.use(uncaughtErrorHandler);

  // Cloudflare holds idle keep-alive connections ~100s, so keepAliveTimeout must exceed
  // that to avoid 502s when CF reuses a connection the server was about to close.
  // headersTimeout must be >= keepAliveTimeout per Node docs. Set before listen() so the
  // very first accepted connection uses them.
  httpServer.keepAliveTimeout = 120_000;
  httpServer.headersTimeout = 125_000;

  // Listen AFTER every route, middleware, and error handler is registered. Moving this
  // earlier opens a race where a request arrives before notFoundMiddleware / uncaughtErrorHandler
  // is wired up, and any async setup introduced below this line would widen that window.
  const server = httpServer.listen(Number(ENV.PORT), () => {
    logger.info(`Listening at http://localhost:${ENV.PORT}`);
  });

  server.on('error', (error) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((error as any).code === 'EADDRINUSE') {
      logger.info('Kill with: lsof -ti:3333 | xargs kill -9');
      logger.error({ err: error }, `Port ${ENV.PORT} is already in use`);
      process.exit(1);
    } else {
      logger.error({ err: error }, '[SERVER][ERROR]');
    }
  });

  // Graceful shutdown only in forked cluster workers. Gating on `cluster.isWorker`
  // (not an env flag) keeps this in sync with the cluster gate at the top of the file
  // and preserves the dev UX — in dev, `nx serve` restarts per file save and the pg
  // pool drain would add ~30s per restart.
  if (cluster.isWorker) {
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      server.close(() => {
        logger.info('Server closed');

        pgPool.end().then(() => {
          logger.info('DB pool closed');
          process.exit(0);
        });
      });

      // Force close after 30s
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 30_000);
    });
  }
}
