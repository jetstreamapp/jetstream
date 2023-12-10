import express from 'express';
import Router from 'express-promise-router';
import * as bulkApiController from '../controllers/sf-bulk-api.controller';
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
routes.get(
  '/bulk/:jobId/:batchId/file',
  ensureOrgExists,
  validate(bulkApiController.routeValidators.downloadResultsFile),
  bulkApiController.downloadResultsFile
);

export default routes;
