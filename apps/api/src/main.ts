import { json, urlencoded, raw } from 'body-parser';
import * as cors from 'cors';
import * as express from 'express';
import { join } from 'path';
import { apiRoutes, landingRoutes, oauthRoutes, staticAuthenticatedRoutes } from './app/routes';
import { logRoute, notFoundMiddleware } from './app/routes/route.middleware';
import { uncaughtErrorHandler, healthCheck } from './app/utils/response.handlers';
import { environment } from './environments/environment';
import * as session from 'express-session';
import * as pgSimple from 'connect-pg-simple';
import { pgPool } from './app/config/db.config';
import { SESSION_EXP_DAYS, HTTP } from '@jetstream/shared/constants';
import { ApplicationCookie } from '@jetstream/types';
import { logger } from './app/config/logger.config';
import * as passport from 'passport';
import * as Auth0Strategy from 'passport-auth0';
import { ENV } from './app/config/env-config';
import * as helmet from 'helmet';

const pgSession = pgSimple(session);

const app = express();

if (environment.production) {
  app.set('trust proxy', 1); // required for environments such as heroku / {render?}
}

// Setup session
app.use(
  session({
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
    name: 'sessionid',
  })
);
// app.use(compression());
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'", '*.rollbar.com', '*.google.com'],
        baseUri: ["'self'"],
        blockAllMixedContent: [],
        fontSrc: ["'self'", 'https:', "'unsafe-inline'", 'data:'],
        frameAncestors: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        scriptSrcAttr: ["'none'"],
        styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
        upgradeInsecureRequests: [],
      },
    },
  })
);

// Setup application cookie
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  const appCookie: ApplicationCookie = {
    serverUrl: ENV.JETSTREAM_SERVER_URL,
    environment: ENV.ENVIRONMENT as any,
    defaultApiVersion: `v${ENV.SFDC_FALLBACK_API_VERSION}`,
  };
  res.cookie(HTTP.COOKIE.JETSTREAM, appCookie, { httpOnly: false, sameSite: 'strict' });
  next();
});

passport.use(
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

passport.serializeUser(function (user, done) {
  done(null, user);
});

passport.deserializeUser(function (user, done) {
  done(null, user);
});

app.use(passport.initialize());
app.use(passport.session());

app.use(raw({ limit: '30mb', type: ['text/csv'] }));
app.use(json({ limit: '20mb', type: ['json', 'application/csp-report'] }));
app.use(urlencoded({ extended: true }));

app.use('/healthz', healthCheck);
app.use('/api', logRoute, apiRoutes);
app.use('/static', logRoute, staticAuthenticatedRoutes); // these are routes that return files or redirect (e.x. NOT JSON)
app.use('/landing', logRoute, landingRoutes);
app.use('/oauth', logRoute, oauthRoutes); // NOTE: there are also static files with same path

const server = app.listen(Number(ENV.PORT), () => {
  logger.info('Listening at http://localhost:' + ENV.PORT);
});

if (!environment.production) {
  app.use(cors({ origin: /http:\/\/localhost:[0-9]+$/ }));
}

app.use('/assets', express.static(join(__dirname, './assets')));

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
