import './app/utils/config';
import { json, urlencoded } from 'body-parser';
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

const pgSession = pgSimple(session);

const app = express();

// Setup session
app.use(
  session({
    store: new pgSession({
      pool: pgPool,
      tableName: 'sessions',
    }),
    cookie: {
      path: '/',
      httpOnly: false,
      secure: environment.production,
      maxAge: 1000 * 60 * 60 * 24 * SESSION_EXP_DAYS,
      domain: process.env.JETSTREAM_SERVER_DOMAIN,
    },
    secret: process.env.JESTREAM_SESSION_SECRET,
    rolling: true,
    // resave: true, // pgSession appears to implement "touch" so this should not be needed
    saveUninitialized: false,
    name: 'sessionid',
  })
);
// app.use(compression());
// app.use(helmet({...}));

// Setup application cookie
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  const appCookie: ApplicationCookie = {
    serverUrl: process.env.JETSTREAM_SERVER_URL,
  };
  res.cookie(HTTP.COOKIE.JETSTREAM, appCookie, { httpOnly: false });
  next();
});

app.use(json({ limit: '20mb' }));
app.use(urlencoded({ extended: true }));

app.use('/healthz', healthCheck);
app.use('/api', logRoute, apiRoutes);
app.use('/static', logRoute, staticAuthenticatedRoutes); // these are routes that return files or redirect (e.x. NOT JSON)
app.use('/landing', logRoute, landingRoutes);
app.use('/oauth', logRoute, oauthRoutes); // NOTE: there are also static files with same path

const port = process.env.port || 3333;

const server = app.listen(port, () => {
  console.log('Listening at http://localhost:' + port);
});

if (!environment.production) {
  app.use(cors({ origin: /http:\/\/localhost:[0-9]+$/ }));
}

app.use(express.static(join(__dirname, './assets')));

if (environment.production) {
  app.set('trust proxy', 1);
  app.use(express.static(join(__dirname, '../landing/exported')));
  app.use(express.static(join(__dirname, '../jetstream')));
  app.use('/app', logRoute, (req: express.Request, res: express.Response) => {
    res.sendFile(join(__dirname, '../jetstream/index.html'));
  });
}

app.use('*', notFoundMiddleware);
app.use(uncaughtErrorHandler);

server.on('error', console.error);
