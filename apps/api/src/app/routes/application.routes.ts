import * as express from 'express';
import * as SfQueryController from '../controllers/sf-query.controller';
import { logRoute, addOrgsToLocal, ensureOrgExists } from './route.middleware';
import Router from 'express-promise-router';

const routes: express.Router = Router();

routes.use(logRoute);
routes.use(addOrgsToLocal);

routes.get('/describe', ensureOrgExists, SfQueryController.describe);
routes.get('/describe/:sobject', ensureOrgExists, SfQueryController.describeSObject);
routes.post('/query', ensureOrgExists, SfQueryController.query);

export default routes;
