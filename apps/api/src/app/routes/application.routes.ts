import * as express from 'express';
import * as SfQueryController from '../controllers/sf-query.controller';
import * as userController from '../controllers/user.controller';
import { addOrgsToLocal, ensureOrgExists, checkAuth } from './route.middleware';
import Router from 'express-promise-router';

const routes: express.Router = Router();

routes.use(addOrgsToLocal);
routes.use(checkAuth); // NOTE: all routes here must be authenticated

routes.get('/me', userController.getUserProfile);

routes.get('/describe', ensureOrgExists, SfQueryController.describe);
routes.get('/describe/:sobject', ensureOrgExists, SfQueryController.describeSObject);
routes.post('/query', ensureOrgExists, SfQueryController.query);

export default routes;
