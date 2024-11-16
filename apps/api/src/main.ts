import { ClusterMemoryStorePrimary } from '@express-rate-limit/cluster-memory-store';
import '@jetstream/api-config'; // this gets imported first to ensure as some items require early initialization
import { ENV, getExceptionLog, httpLogger, logger, pgPool, prisma } from '@jetstream/api-config';
import { hashPassword, pruneExpiredRecords } from '@jetstream/auth/server';
import { SessionData as JetstreamSessionData } from '@jetstream/auth/types';
import { HTTP, SESSION_EXP_DAYS } from '@jetstream/shared/constants';
import { AsyncIntervalTimer } from '@jetstream/shared/node-utils';
import { json, raw, urlencoded } from 'body-parser';
import cluster from 'cluster';
import pgSimple from 'connect-pg-simple';
import cors from 'cors';
import express from 'express';
import proxy from 'express-http-proxy';
import session from 'express-session';
import helmet from 'helmet';
import { cpus } from 'os';
import { join } from 'path';
import { initSocketServer } from './app/controllers/socket.controller';
import { apiRoutes, authRoutes, oauthRoutes, platformEventRoutes, staticAuthenticatedRoutes, testRoutes } from './app/routes';
import {
  addContextMiddleware,
  blockBotByUserAgentMiddleware,
  destroySessionIfPendingVerificationIsExpired,
  notFoundMiddleware,
  redirectIfPendingVerificationMiddleware,
  setApplicationCookieMiddleware,
} from './app/routes/route.middleware';
import { blockBotHandler, healthCheck, uncaughtErrorHandler } from './app/utils/response.handlers';
import { environment } from './environments/environment';

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
GIT_VERSION=${ENV.GIT_VERSION ?? '<unspecified>'}
LOG_LEVEL=${ENV.LOG_LEVEL}
JETSTREAM_SERVER_URL=${ENV.JETSTREAM_SERVER_URL}
JETSTREAM_CLIENT_URL=${ENV.JETSTREAM_CLIENT_URL}
  `);
}

if (ENV.NODE_ENV === 'production' && !ENV.CI && cluster.isPrimary) {
  logger.info(`Number of CPUs is ${CPU_COUNT}`);
  logger.info(`Master ${process.pid} is running`);

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
  const httpServer = initSocketServer(app, [sessionMiddleware]);

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
          ],
          baseUri: ["'self'"],
          blockAllMixedContent: [],
          fontSrc: ["'self'", 'https:', "'unsafe-inline'", 'data:', '*.gstatic.com'],
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
          ],
          objectSrc: ["'none'"],
          scriptSrc: [
            "'self'",
            "'sha256-AS526U4qXJy7/SohgsysWUxi77DtcgSmP0hNfTo6/Hs='", // Google Analytics (Docs)
            "'sha256-pOkCIUf8FXwCoKWPXTEJAC2XGbyg3ftSrE+IES4aqEY='", // Google Analytics (Next/React)
            "'sha256-7mNBpJaHD4L73RpSf1pEaFD17uW3H/9+P1AYhm+j/Dg='", // Monaco unhandledrejection script
            "'sha256-djX4iruGclmwOFqyJyEvkkFU0dkSDNqkDpKOJMUO70E='", // __IS_CHROME_EXTENSION__ script
            'blob:',
            '*.google.com',
            '*.gstatic.com',
            '*.google-analytics.com',
            '*.googletagmanager.com',
            'https://challenges.cloudflare.com',
          ],
          scriptSrcAttr: ["'none'"],
          styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
          upgradeInsecureRequests: [],
        },
      },
    })
  );

  if (ENV.ENVIRONMENT === 'development') {
    /**
     * All analytics go through our server instead of directly to amplitude
     * This ensures that amplitude is not blocked by various browser tools
     */
    app.use('/analytics', cors({ origin: /http:\/\/localhost:[0-9]+$/ }), (req, res) => res.status(200).send('success'));
  } else {
    /**
     * All analytics go through our server instead of directly to amplitude
     * This ensures that amplitude is not blocked by various browser tools
     */
    app.use('/analytics', proxy('https://api.amplitude.com'));
  }

  app.use(blockBotByUserAgentMiddleware);
  app.use(setApplicationCookieMiddleware);

  app.use(httpLogger);

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

  app.use(raw({ limit: '30mb', type: ['text/csv'] }));
  app.use(raw({ limit: '30mb', type: ['application/zip'] }));
  app.use(json({ limit: '20mb', type: ['json', 'application/csp-report'] }));
  app.use(urlencoded({ extended: true }));

  app.use(destroySessionIfPendingVerificationIsExpired);

  app.use('/healthz', healthCheck);
  app.use('/api/auth', authRoutes);
  app.use('/api', apiRoutes);
  app.use('/static', staticAuthenticatedRoutes); // these are routes that return files or redirect (e.x. NOT JSON)
  app.use('/oauth', oauthRoutes); // NOTE: there are also static files with same path

  if (ENV.ENVIRONMENT !== 'production' || ENV.CI) {
    app.use('/test', testRoutes);
  }

  const server = httpServer.listen(Number(ENV.PORT), () => {
    logger.info(`Listening at http://localhost:${ENV.PORT}`);
  });

  if (!environment.production) {
    app.use(cors({ origin: /http:\/\/localhost:[0-9]+$/ }));
  }

  app.use('/codicon.ttf', (req: express.Request, res: express.Response) => {
    res.sendFile(join(__dirname, './assets/js/monaco/vs/base/browser/ui/codicons/codicon/codicon.ttf'), { maxAge: '1m' });
  });
  app.use('/assets', express.static(join(__dirname, './assets'), { maxAge: '1m' }));
  app.use('/fonts', express.static(join(__dirname, './assets/fonts')));
  app.use(express.static(join(__dirname, '../landing')));
  // SERVICE WORKER FOR DOWNLOAD ZIP
  app.use('/download-zip.sw.js', (req: express.Request, res: express.Response) => {
    res.sendFile(join(__dirname, '../download-zip-sw/download-zip.sw.js'), { maxAge: '1m' });
  });

  if (environment.production || ENV.CI || ENV.JETSTREAM_CLIENT_URL.replace('/app', '') === ENV.JETSTREAM_SERVER_URL) {
    app.use(express.static(join(__dirname, '../jetstream')));
    app.use('/app', redirectIfPendingVerificationMiddleware, (req: express.Request, res: express.Response) => {
      res.sendFile(join(__dirname, '../jetstream/index.html'));
    });
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
          deletedAt: null,
          lastLoggedIn: new Date(),
          preferences: { create: { skipFrontdoorLogin: false } },
          authFactors: { create: { type: '2fa-email', enabled: false } },
        },
        update: {},
        where: { id: user.id },
      });
      logger.info('Example user created');
    }
  })();
} catch (ex) {
  logger.error(getExceptionLog(ex), '[EXAMPLE_USER][ERROR] Fatal error, could not upsert example user');
  process.exit(1);
}
