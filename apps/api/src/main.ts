import '@jetstream/api-config'; // this gets imported first to ensure as some items require early initialization
import { ENV, getExceptionLog, httpLogger, logger, pgPool } from '@jetstream/api-config';
import { HTTP, SESSION_EXP_DAYS } from '@jetstream/shared/constants';
import { json, raw, urlencoded } from 'body-parser';
import cluster from 'cluster';
import pgSimple from 'connect-pg-simple';
import cors from 'cors';
import express from 'express';
import proxy from 'express-http-proxy';
import session from 'express-session';
import helmet from 'helmet';
import { cpus } from 'os';
import passport from 'passport';
import Auth0Strategy from 'passport-auth0';
import { Strategy as CustomStrategy } from 'passport-custom';
import { join } from 'path';
import { initSocketServer } from './app/controllers/socket.controller';
import { apiRoutes, oauthRoutes, platformEventRoutes, staticAuthenticatedRoutes, testRoutes } from './app/routes';
import {
  addContextMiddleware,
  blockBotByUserAgentMiddleware,
  notFoundMiddleware,
  setApplicationCookieMiddleware,
} from './app/routes/route.middleware';
import { blockBotHandler, healthCheck, uncaughtErrorHandler } from './app/utils/response.handlers';
import { environment } from './environments/environment';

declare module 'express-session' {
  interface SessionData {
    activityExp: number;
    orgAuth?: { code_verifier: string; nonce: string; state: string; loginUrl: string };
  }
}

// NOTE: render reports more CPUs than are actually available
const CPU_COUNT = Math.min(cpus().length, 3);

if (ENV.NODE_ENV === 'production' && cluster.isPrimary) {
  logger.info(`Number of CPUs is ${CPU_COUNT}`);
  logger.info(`Master ${process.pid} is running`);

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
      // httpOnly: true,
      secure: !ENV.IS_LOCAL_DOCKER && environment.production,
      maxAge: 1000 * 60 * 60 * 24 * SESSION_EXP_DAYS,
      // sameSite: 'strict',
    },
    secret: ENV.JETSTREAM_SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    // This will extend the cookie expiration date if there is a request of any kind to a logged in user
    rolling: true,
    name: 'sessionid',
  });

  passport.serializeUser(function (user, done) {
    done(null, user);
  });

  passport.deserializeUser(function (user, done) {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    done(null, user!);
  });

  const passportInitMiddleware = passport.initialize();
  const passportMiddleware = passport.session();

  const app = express();
  const httpServer = initSocketServer(app, [sessionMiddleware, passportInitMiddleware, passportMiddleware]);

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
            'blob:',
            '*.google.com',
            '*.gstatic.com',
            '*.google-analytics.com',
            '*.googletagmanager.com',
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

  /** Manual test user, skip Auth0 completely */
  passport.use(
    'custom',
    new CustomStrategy(function (req, callback) {
      if (req.hostname !== 'localhost' || !ENV.EXAMPLE_USER_OVERRIDE || !ENV.EXAMPLE_USER) {
        return callback(new Error('Test user not enabled'));
      }

      const user = ENV.EXAMPLE_USER;
      req.user = user;
      callback(null, user);
    })
  );

  passport.use(
    'auth0',
    new Auth0Strategy(
      {
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        domain: ENV.AUTH0_DOMAIN!,
        clientID: ENV.AUTH0_CLIENT_ID!,
        clientSecret: ENV.AUTH0_CLIENT_SECRET!,
        callbackURL: `${ENV.JETSTREAM_SERVER_URL}/oauth/callback`,
      },
      (accessToken, refreshToken, extraParams, profile, done) => {
        // accessToken is the token to call Auth0 API (not needed in the most cases)
        // extraParams.id_token has the JSON Web Token
        // profile has all the information from the user
        return done(null, profile);
      }
    )
  );

  /** This configuration is used for authorization, not authentication (e.x. link second identity to user) */
  passport.use(
    'auth0-authz',
    new Auth0Strategy(
      {
        domain: ENV.AUTH0_DOMAIN!,
        clientID: ENV.AUTH0_CLIENT_ID!,
        clientSecret: ENV.AUTH0_CLIENT_SECRET!,
        callbackURL: `${ENV.JETSTREAM_SERVER_URL}/oauth/identity/link/callback`,
      },
      (accessToken, refreshToken, extraParams, profile, done) => {
        // accessToken is the token to call Auth0 API (not needed in the most cases)
        // extraParams.id_token has the JSON Web Token
        // profile has all the information from the user
        return done(null, profile);
      }
    )
  );

  app.use(passportInitMiddleware);
  app.use(passportMiddleware);
  app.use(httpLogger);

  // proxy must be provided prior to body parser to ensure streaming response
  if (ENV.ENVIRONMENT === 'development') {
    app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
      if (req.headers.origin?.includes('localhost')) {
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin);
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

  app.use('/healthz', healthCheck);
  app.use('/api', apiRoutes);
  app.use('/static', staticAuthenticatedRoutes); // these are routes that return files or redirect (e.x. NOT JSON)
  app.use('/oauth', oauthRoutes); // NOTE: there are also static files with same path

  if (ENV.ENVIRONMENT !== 'production' || ENV.IS_CI) {
    app.use('/test', testRoutes);
  }

  // const server = app.listen(Number(ENV.PORT), () => {
  //   logger.info('Listening at http://localhost:' + ENV.PORT);
  // });

  const server = httpServer.listen(Number(ENV.PORT), () => {
    logger.info('Listening at http://localhost:' + ENV.PORT);
    logger.info('[ENVIRONMENT]: ' + ENV.ENVIRONMENT);
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

  if (environment.production || ENV.IS_CI) {
    app.use(express.static(join(__dirname, '../jetstream')));
    app.use('/app', (req: express.Request, res: express.Response) => {
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
