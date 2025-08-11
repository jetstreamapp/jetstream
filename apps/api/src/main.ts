import { ClusterMemoryStorePrimary } from '@express-rate-limit/cluster-memory-store';
import '@jetstream/api-config'; // this gets imported first to ensure as some items require early initialization
import { ENV, getExceptionLog, httpLogger, logger, pgPool, prisma } from '@jetstream/api-config';
import { hashPassword, pruneExpiredRecords } from '@jetstream/auth/server';
import { SessionData as JetstreamSessionData, UserProfileSession } from '@jetstream/auth/types';
import { HTTP, SESSION_EXP_DAYS } from '@jetstream/shared/constants';
import { AsyncIntervalTimer } from '@jetstream/shared/node-utils';
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
import http from 'node:http';
import { cpus } from 'os';
import { join } from 'path';
import { initSocketServer } from './app/controllers/socket.controller';
import {
  apiRoutes,
  authRoutes,
  desktopAppRoutes,
  desktopAssetsRoutes,
  oauthRoutes,
  platformEventRoutes,
  staticAuthenticatedRoutes,
  testRoutes,
  webExtensionRoutes,
  webhookRoutes,
} from './app/routes';
import {
  addContextMiddleware,
  blockBotByUserAgentMiddleware,
  destroySessionIfPendingVerificationIsExpired,
  notFoundMiddleware,
  redirectIfMfaEnrollmentRequiredMiddleware,
  redirectIfPendingVerificationMiddleware,
  setApplicationCookieMiddleware,
} from './app/routes/route.middleware';
import { blockBotHandler, healthCheck, uncaughtErrorHandler } from './app/utils/response.handlers';
import { environment } from './environments/environment';

declare module 'express' {
  interface Request {
    /**
     * Authenticated user for external authenticated routes (e.g. web extension, desktop app)
     * populated in externalAuthService.getExternalAuthMiddleware
     */
    externalAuth?: {
      user: UserProfileSession;
      deviceId?: string;
    };
  }
}

declare module 'express-session' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface SessionData extends JetstreamSessionData {}
}

// NOTE: render reports more CPUs than are actually available
const CPU_COUNT = Math.min(cpus().length, 3);

if (ENV.NODE_ENV !== 'production' || cluster.isPrimary) {
  setTimeout(() => {
    new AsyncIntervalTimer(pruneExpiredRecords, { name: 'pruneExpiredRecords', intervalMs: /** 1 hour */ 60 * 60 * 1000, runOnInit: true });
  }, 1000 * 5); // Delay 5 seconds to allow for other services to start
}

if (cluster.isPrimary) {
  console.log(`
     ██╗███████╗████████╗███████╗████████╗██████╗ ███████╗ █████╗ ███╗   ███╗
     ██║██╔════╝╚══██╔══╝██╔════╝╚══██╔══╝██╔══██╗██╔════╝██╔══██╗████╗ ████║
     ██║█████╗     ██║   ███████╗   ██║   ██████╔╝█████╗  ███████║██╔████╔██║
██   ██║██╔══╝     ██║   ╚════██║   ██║   ██╔══██╗██╔══╝  ██╔══██║██║╚██╔╝██║
╚█████╔╝███████╗   ██║   ███████║   ██║   ██║  ██║███████╗██║  ██║██║ ╚═╝ ██║
 ╚════╝ ╚══════╝   ╚═╝   ╚══════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚═╝     ╚═╝

NODE_ENV=${ENV.NODE_ENV}
ENVIRONMENT=${ENV.ENVIRONMENT}
VERSION=${ENV.VERSION ?? '<unspecified>'}
LOG_LEVEL=${ENV.LOG_LEVEL}
JETSTREAM_SERVER_URL=${ENV.JETSTREAM_SERVER_URL}
JETSTREAM_CLIENT_URL=${ENV.JETSTREAM_CLIENT_URL}
  `);
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

  cluster.on('exit', (worker, code, signal) => {
    logger.info({ code, signal }, `worker ${worker.process.pid} died, restarting`);
    cluster.fork();
  });
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

  // app.use(compression());
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: [
            "'self'",
            '*.google-analytics.com',
            '*.google.com',
            '*.googleapis.com',
            '*.gstatic.com',
            '*.rollbar.com',
            'api.amplitude.com',
            'api.cloudinary.com',
            'https://challenges.cloudflare.com',
            'https://maps.googleapis.com',
            'https://checkout.stripe.com',
            'https://connect-js.stripe.com',
            'https://js.stripe.com',
            'https://api.stripe.com',
            'https://*.js.stripe.com',
            'https://hooks.stripe.com',
            'https://releases.getjetstream.app',
          ],
          baseUri: ["'self'"],
          blockAllMixedContent: [],
          fontSrc: ["'self'", 'https:', "'unsafe-inline'", 'data:', '*.gstatic.com', 'https://checkout.stripe.com'],
          frameAncestors: ["'self'", '*.google.com'],
          imgSrc: [
            "'self'",
            'data:',
            '*.cloudinary.com',
            '*.ctfassets.net',
            '*.documentforce.com',
            '*.force.com',
            '*.githubusercontent.com',
            '*.google-analytics.com',
            '*.googletagmanager.com',
            '*.googleusercontent.com',
            '*.gravatar.com',
            '*.gstatic.com',
            '*.salesforce.com',
            '*.wp.com',
            'https://*.stripe.com',
          ],
          objectSrc: ["'none'"],
          scriptSrc: [
            "'self'",
            "'sha256-AS526U4qXJy7/SohgsysWUxi77DtcgSmP0hNfTo6/Hs='", // Google Analytics (Docs)
            "'sha256-pOkCIUf8FXwCoKWPXTEJAC2XGbyg3ftSrE+IES4aqEY='", // Google Analytics (Next/React)
            "'sha256-7mNBpJaHD4L73RpSf1pEaFD17uW3H/9+P1AYhm+j/Dg='", // Monaco unhandledrejection script
            "'sha256-U1ZWk/Nvev4hBoGjgXSP/YN1w4VGTmd4NTYtXEr58xI='", // __IS_BROWSER_EXTENSION__ script
            'blob:',
            '*.google.com',
            '*.gstatic.com',
            '*.google-analytics.com',
            '*.googletagmanager.com',
            'https://maps.googleapis.com',
            'https://challenges.cloudflare.com',
            'https://checkout.stripe.com',
            'https://connect-js.stripe.com',
            'https://*.js.stripe.com',
            'https://js.stripe.com',
          ],
          scriptSrcAttr: ["'none'"],
          styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
          upgradeInsecureRequests: ENV.ENVIRONMENT === 'development' ? null : [],
        },
      },
    })
  );

  app.use(blockBotByUserAgentMiddleware);

  if (ENV.ENVIRONMENT === 'development') {
    app.use('/analytics', cors({ origin: /http:\/\/localhost:[0-9]+$/ }), (req, res) => res.status(200).send('success'));
  } else {
    app.use(
      '/analytics',
      proxy('https://api2.amplitude.com', {
        proxyReqPathResolver: (req) => req.originalUrl.replace('/analytics', '/2/httpapi'),
      })
    );
  }

  app.use(setApplicationCookieMiddleware);

  app.use(httpLogger);

  // Handle CORS for web extension routes
  const allowedHeaders = [
    HTTP.HEADERS.ACCEPT,
    HTTP.HEADERS.CONTENT_TYPE,
    HTTP.HEADERS.AUTHORIZATION,
    HTTP.HEADERS.X_EXT_DEVICE_ID,
    HTTP.HEADERS.X_WEB_EXTENSION_DEVICE_ID,
  ].join(', ');
  app.use('/web-extension/*', (req: express.Request, res: express.Response, next: express.NextFunction) => {
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

  app.options('/web-extension/*', (req: express.Request, res: express.Response, next: express.NextFunction) => {
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
          ].join(', ')
        );
      }
      next();
    });
    app.options(
      '*',
      (req: express.Request, res: express.Response, next: express.NextFunction) => {
        res.setHeader('Access-Control-Allow-Credentials', 'true');
        res.setHeader('Access-Control-Allow-Origin', '*');
        next();
      },
      cors({
        origin: true,
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
      })
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

  app.use(destroySessionIfPendingVerificationIsExpired);

  app.use('/healthz', healthCheck);
  app.use('/api/auth', authRoutes);
  app.use('/api', apiRoutes);
  app.use('/desktop-assets', desktopAssetsRoutes);
  app.use('/static', staticAuthenticatedRoutes); // these are routes that return files or redirect (e.x. NOT JSON)
  app.use('/oauth', oauthRoutes); // NOTE: there are also static files with same path
  app.use('/web-extension', webExtensionRoutes);
  app.use('/desktop-app', desktopAppRoutes);

  if (ENV.ENVIRONMENT !== 'production' || ENV.CI) {
    app.use('/test', testRoutes);
  }

  const server = httpServer.listen(Number(ENV.PORT), () => {
    logger.info(`Listening at http://localhost:${ENV.PORT}`);
  });

  if (!environment.production) {
    app.use(cors({ origin: /http:\/\/localhost:[0-9]+$/ }));
  }

  app.use('/assets/js/monaco/vs', express.static(join(__dirname, '../../../node_modules/monaco-editor/min/vs')));
  app.use('/.well-known', express.static(join(__dirname, './assets/.well-known')));
  app.use('/assets', express.static(join(__dirname, './assets'), { maxAge: '1m' }));
  app.use('/fonts', express.static(join(__dirname, './assets/fonts')));
  app.use(express.static(join(__dirname, '../landing')));
  // SERVICE WORKER FOR DOWNLOAD ZIP
  app.use('/download-zip.sw.js', (req: express.Request, res: express.Response) => {
    res.sendFile(join(__dirname, '../download-zip-sw/download-zip.sw.js'), { maxAge: '1m' });
  });

  if (environment.production || ENV.CI || ENV.JETSTREAM_CLIENT_URL.replace('/app', '') === ENV.JETSTREAM_SERVER_URL) {
    app.use(express.static(join(__dirname, '../jetstream')));
    app.use(
      '/app',
      redirectIfPendingVerificationMiddleware,
      redirectIfMfaEnrollmentRequiredMiddleware,
      (req: express.Request, res: express.Response) => {
        res.sendFile(join(__dirname, '../jetstream/index.html'));
      }
    );
  }

  /**
   * SEND 418 FOR BLOCKED ROUTES THAT ARE PRODUCED BY BOTS
   */

  const BOT_ROUTES = [
    '/_ignition*',
    '/*.aspx',
    '/*.env*',
    '/*.php',
    '/*.txt',
    '/*.xml',
    '/*magento_version',
    '/*phpinfo*',
    '/*wp-content*',
    '/*wp-includes*',
    '//feed*',
    '/%20',
    '/ALFA_DATA*',
    '/cgi-bin*',
    '/humans.txt',
    '/tmp*',
    '/view-source*',
    '/wp*',
  ];

  BOT_ROUTES.forEach((route) => app.use(route, blockBotHandler));

  app.use('*', notFoundMiddleware);
  app.use(uncaughtErrorHandler);

  server.on('error', (error: Error) => {
    logger.error(getExceptionLog(error), '[SERVER][ERROR]');
  });

  if (ENV.ENVIRONMENT === 'production') {
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

/**
 * FIXME: Should this live somewhere else and be de-coupled with application?
 */
try {
  (async () => {
    if (ENV.EXAMPLE_USER && ENV.EXAMPLE_USER_PASSWORD && (ENV.ENVIRONMENT !== 'production' || ENV.CI)) {
      const passwordHash = await hashPassword(ENV.EXAMPLE_USER_PASSWORD);
      const user = ENV.EXAMPLE_USER;
      logger.info('Upserting example user. id: %s', user.id);
      await prisma.user.upsert({
        create: {
          id: user.id,
          userId: user.userId,
          email: user.email,
          emailVerified: user.emailVerified,
          name: user.name,
          password: passwordHash,
          passwordUpdatedAt: new Date(),
          lastLoggedIn: new Date(),
          preferences: { create: { skipFrontdoorLogin: false } },
          authFactors: { create: { type: '2fa-email', enabled: false } },
          entitlements: { create: { chromeExtension: false, recordSync: false, googleDrive: false, desktop: false } },
        },
        update: {
          entitlements: {
            upsert: {
              create: { chromeExtension: false, recordSync: false, googleDrive: false, desktop: false },
              update: { chromeExtension: false, recordSync: false, googleDrive: false, desktop: false },
            },
          },
        },
        where: { id: user.id },
      });
    }
  })();
} catch (ex) {
  logger.error(getExceptionLog(ex), '[EXAMPLE_USER][ERROR] Fatal error, could not upsert example user');
  process.exit(1);
}
