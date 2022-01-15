import * as express from 'express';
import Router from 'express-promise-router';
import * as bulkApiController from '../controllers/sf-bulk-api.controller';
import * as sfMiscController from '../controllers/sf-misc.controller';
import { addOrgsToLocal, checkAuth, ensureOrgExists, validate } from './route.middleware';

const routes: express.Router = Router();

routes.use(addOrgsToLocal);
routes.use(checkAuth);
routes.get(
  '/sfdc/login',
  ensureOrgExists,
  validate(sfMiscController.routeValidators.getFrontdoorLoginUrl),
  sfMiscController.getFrontdoorLoginUrl
);

// Is this used?
routes.get(
  '/sfdc/bulk/:jobId/:batchId',
  ensureOrgExists,
  validate(bulkApiController.routeValidators.downloadResultsFile),
  bulkApiController.downloadResultsFile
);

export default routes;
