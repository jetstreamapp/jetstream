import express, { Router } from 'express';
import { routeDefinition as bulkApiController } from '../controllers/sf-bulk-api.controller';
import { routeDefinition as miscController } from '../controllers/sf-misc.controller';
import { addOrgsToLocal, checkAuth } from './route.middleware';

const routes: express.Router = Router();

routes.use(checkAuth);
routes.use(addOrgsToLocal);
routes.get('/sfdc/login', miscController.getFrontdoorLoginUrl.controllerFn());
routes.get('/bulk/:jobId/:batchId/file', bulkApiController.downloadResultsFile.controllerFn());

export default routes;
