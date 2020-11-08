import * as express from 'express';
import Router from 'express-promise-router';
import * as bulkApiController from '../controllers/sf-bulk-api.controller';
import * as SfMiscController from '../controllers/sf-misc.controller';
import { addOrgsToLocal, checkAuth, ensureOrgExists } from './route.middleware';

const routes: express.Router = Router();

routes.use(addOrgsToLocal);
routes.use(checkAuth); // NOTE: all routes here must be authenticated

routes.get('/sfdc/login', ensureOrgExists, SfMiscController.getFrontdoorLoginUrl);
routes.get('/sfdc/bulk/:jobId/:batchId', ensureOrgExists, bulkApiController.downloadResultsFile);

export default routes;
