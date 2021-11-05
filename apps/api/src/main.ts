import { HTTP, SESSION_EXP_DAYS } from '@jetstream/shared/constants';
import { ApplicationCookie } from '@jetstream/types';
import { json, raw, urlencoded } from 'body-parser';
import * as pgSimple from 'connect-pg-simple';
import * as cors from 'cors';
import * as express from 'express';
import proxy from 'express-http-proxy';
import * as session from 'express-session';
import * as helmet from 'helmet';
import * as passport from 'passport';
import * as Auth0Strategy from 'passport-auth0';
import { join } from 'path';
import { pgPool } from './app/config/db.config';
import { ENV } from './app/config/env-config';
import { logger } from './app/config/logger.config';
import { initSocketServer } from './app/controllers/socket.controller';
import { apiRoutes, landingRoutes, oauthRoutes, platformEventRoutes, staticAuthenticatedRoutes } from './app/routes';
import { logRoute, notFoundMiddleware } from './app/routes/route.middleware';
import { healthCheck, uncaughtErrorHandler } from './app/utils/response.handlers';
import { environment } from './environments/environment';

declare module 'express-session' {
  interface SessionData {
    activityExp: number;
  }
}

const pgSession = pgSimple(session);

const sessionMiddleware = session({
  store: new pgSession({
    pool: pgPool,
    tableName: 'sessions',
  }),
  cookie: {
    path: '/',
    // httpOnly: true,
    secure: environment.production,
    maxAge: 1000 * 60 * 60 * 24 * SESSION_EXP_DAYS,
    // sameSite: 'strict',
  },
  secret: ENV.JESTREAM_SESSION_SECRET,
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
  done(null, user);
});

const passportInitMiddleware = passport.initialize();
const passportMiddleware = passport.session();

const app = express();
const httpServer = initSocketServer(app, [sessionMiddleware, passportInitMiddleware, passportMiddleware]);

if (environment.production) {
  app.set('trust proxy', 1); // required for environments such as heroku / {render?}
}

// Setup session
app.use(sessionMiddleware);

// app.use(compression());
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: [
          "'self'",
          '*.rollbar.com',
          '*.google.com',
          '*.gstatic.com',
          'api.amplitude.com',
          '*.googleapis.com',
          'api.cloudinary.com',
        ],
        baseUri: ["'self'"],
        blockAllMixedContent: [],
        fontSrc: ["'self'", 'https:', "'unsafe-inline'", 'data:'],
        frameAncestors: ["'self'", '*.google.com'],
        imgSrc: [
          "'self'",
          'data:',
          '*.cloudinary.com',
          '*.documentforce.com',
          '*.force.com',
          '*.githubusercontent.com',
          '*.googleusercontent.com',
          '*.gravatar.com',
          '*.salesforce.com',
          '*.wp.com',
        ],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'", 'blob:', '*.google.com', '*.gstatic.com'],
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

// Setup application cookie
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  const appCookie: ApplicationCookie = {
    serverUrl: ENV.JETSTREAM_SERVER_URL,
    environment: ENV.ENVIRONMENT as any,
    defaultApiVersion: `v${ENV.SFDC_FALLBACK_API_VERSION}`,
    google_appId: ENV.GOOGLE_APP_ID,
    google_apiKey: ENV.GOOGLE_API_KEY,
    google_clientId: ENV.GOOGLE_CLIENT_ID,
  };
  res.cookie(HTTP.COOKIE.JETSTREAM, appCookie, { httpOnly: false, sameSite: 'strict' });
  next();
});

passport.use(
  'auth0',
  new Auth0Strategy(
    {
      domain: ENV.AUTH0_DOMAIN,
      clientID: ENV.AUTH0_CLIENT_ID,
      clientSecret: ENV.AUTH0_CLIENT_SECRET,
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
      domain: ENV.AUTH0_DOMAIN,
      clientID: ENV.AUTH0_CLIENT_ID,
      clientSecret: ENV.AUTH0_CLIENT_SECRET,
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

// proxy must be provided prior to body parser to ensure streaming response
if (ENV.ENVIRONMENT === 'development') {
  app.options(
    '*',
    logRoute,
    (req: express.Request, res: express.Response, next: express.NextFunction) => {
      res.setHeader('Access-Control-Allow-Credentials', 'true');
      next();
    },
    cors({ origin: true })
  );
  app.use('/platform-event', logRoute, cors({ origin: /http:\/\/localhost:[0-9]+$/ }), platformEventRoutes);
} else {
  app.use('/platform-event', logRoute, platformEventRoutes);
}

app.use(raw({ limit: '30mb', type: ['text/csv'] }));
app.use(raw({ limit: '30mb', type: ['application/zip'] }));
app.use(json({ limit: '20mb', type: ['json', 'application/csp-report'] }));
app.use(urlencoded({ extended: true }));

app.use('/healthz', healthCheck);
app.use('/api', logRoute, apiRoutes);
app.use('/static', logRoute, staticAuthenticatedRoutes); // these are routes that return files or redirect (e.x. NOT JSON)
app.use('/landing', logRoute, landingRoutes);
app.use('/oauth', logRoute, oauthRoutes); // NOTE: there are also static files with same path

// const server = app.listen(Number(ENV.PORT), () => {
//   logger.info('Listening at http://localhost:' + ENV.PORT);
// });

const server = httpServer.listen(Number(ENV.PORT), () => {
  logger.info('Listening at http://localhost:' + ENV.PORT);
});

if (!environment.production) {
  app.use(cors({ origin: /http:\/\/localhost:[0-9]+$/ }));
}

app.use('/codicon.ttf', (req: express.Request, res: express.Response) => {
  res.sendFile(join(__dirname, './assets/js/monaco/vs/base/browser/ui/codicons/codicon/codicon.ttf'), { maxAge: '1m' });
});
app.use('/assets', express.static(join(__dirname, './assets'), { maxAge: '1m' }));
app.use('/fonts', express.static(join(__dirname, './assets/fonts')));

if (environment.production) {
  app.use(express.static(join(__dirname, '../landing/exported')));
  app.use(express.static(join(__dirname, '../jetstream')));
  app.use('/app', logRoute, (req: express.Request, res: express.Response) => {
    res.sendFile(join(__dirname, '../jetstream/index.html'));
  });
} else {
  // localhost will only use landing page resources
  app.use(express.static(join(__dirname, '../../../dist/apps/landing/exported')));
}

app.use('*', notFoundMiddleware);
app.use(uncaughtErrorHandler);

server.on('error', logger.error);
