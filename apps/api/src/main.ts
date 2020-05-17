import * as express from 'express';
import { logRoute } from './app/routes-middleware';
import { routes } from './app/routes';
import { handleError } from './app/route-handlers';
import { json, urlencoded } from 'body-parser';

const app = express();

app.use(json({ limit: '20mb' }));
app.use(urlencoded({ extended: true }));

app.use('/api', logRoute, routes);

app.use(handleError);

const port = process.env.port || 3333;
const server = app.listen(port, () => {
  console.log('Listening at http://localhost:' + port + '/api');
});
server.on('error', console.error);
