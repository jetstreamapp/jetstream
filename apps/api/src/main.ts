import './app/utils/config';
import { json, urlencoded } from 'body-parser';
import * as cors from 'cors';
import * as express from 'express';
import { join } from 'path';
import { applicationRoutes, landingRoutes, oauthRoutes } from './app/routes';
import { logRoute, notFoundMiddleware } from './app/routes/route.middleware';
import { uncaughtErrorHandler, healthCheck } from './app/utils/response.handlers';
import { environment } from './environments/environment';

const app = express();

// app.use(sessionMiddleware);
// app.use(compression());
// app.use(helmet({...}));

app.use(json({ limit: '20mb' }));
app.use(urlencoded({ extended: true }));

app.use('/healthz', healthCheck);
app.use('/api', logRoute, applicationRoutes);
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
  app.use(express.static(join(__dirname, '../landing/exported')));
  app.use(express.static(join(__dirname, '../jetstream')));
  app.use('/app', logRoute, (req: express.Request, res: express.Response) => {
    res.sendFile(join(__dirname, '../jetstream/index.html'));
  });
}

app.use('*', notFoundMiddleware);
app.use(uncaughtErrorHandler);

server.on('error', console.error);
