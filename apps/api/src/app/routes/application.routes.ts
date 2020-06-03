import * as express from 'express';
import * as SfQueryController from '../controllers/sf-query.controller';
import { logRoute } from './route.middleware';
import Router from 'express-promise-router';

const routes: express.Router = Router();

routes.use(logRoute);

routes.get('/describe', SfQueryController.describe);
routes.get('/describe/:sobject', SfQueryController.describeSObject);
routes.post('/query', SfQueryController.query);

export default routes;
