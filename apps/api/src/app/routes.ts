import { Router, Request, Response } from 'express';
import * as SfQueryController from './controllers/sf-query.controller';
import { logRoute } from './routes-middleware';
import { sendJson } from './route-handlers';
// import * as middleware from './routes-middleware';

export const routes: Router = Router();

routes.use(logRoute);

routes.get('/', (req: Request, res: Response) => {
  sendJson(res, { test: 'OK' });
});
routes.get('/describe', SfQueryController.describe);
routes.get('/describe/:sobject', SfQueryController.describeSObject);
routes.post('/query', SfQueryController.query);
