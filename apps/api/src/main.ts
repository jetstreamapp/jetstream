import * as express from 'express';
import { logRoute } from './app/routes-middleware';
import { routes } from './app/routes';
import { handleError } from './app/route-handlers';
import { json, urlencoded } from 'body-parser';
import * as cors from 'cors';
import { join } from 'path';

const app = express();

app.use(json({ limit: '20mb' }));
app.use(urlencoded({ extended: true }));

app.use('/api', logRoute, routes);

app.use(handleError);

const port = process.env.port || 3333;
const server = app.listen(port, () => {
  console.log('Listening at http://localhost:' + port + '/api');
});

if (app.get('env') !== 'production') {
  app.use(cors({ origin: /http:\/\/localhost:[0-9]+$/ }));
}

if (app.get('env') === 'production') {
  app.use(express.static(join(__dirname, '../jetstream')));
  app.use('/app', logRoute, (req: express.Request, res: express.Response) => {
    res.sendFile(join(__dirname, '../jetstream/index.html'));
  });
}

server.on('error', console.error);
