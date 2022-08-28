import * as express from 'express';
import Router from 'express-promise-router';
import * as sfMiscController from '../controllers/sf-misc.controller';
import { addOrgsToLocal, checkAuth, ensureOrgExists, validate } from './route.middleware';

const routes: express.Router = Router();

routes.use(checkAuth);
routes.use(addOrgsToLocal);
routes.get(
  '/sfdc/login',
  ensureOrgExists,
  validate(sfMiscController.routeValidators.getFrontdoorLoginUrl),
  sfMiscController.getFrontdoorLoginUrl
);

export default routes;
