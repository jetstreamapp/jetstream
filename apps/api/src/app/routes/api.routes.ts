import * as express from 'express';
import Router from 'express-promise-router';
import * as sfQueryController from '../controllers/sf-query.controller';
import * as sfMiscController from '../controllers/sf-misc.controller';
import * as userController from '../controllers/user.controller';
import * as orgsController from '../controllers/orgs.controller';
import { addOrgsToLocal, checkAuth, ensureOrgExists } from './route.middleware';

const routes: express.Router = Router();

routes.use(addOrgsToLocal);
routes.use(checkAuth); // NOTE: all routes here must be authenticated

routes.get('/me', userController.getUserProfile);

routes.get('/orgs', orgsController.getOrgs);
routes.delete('/orgs/:uniqueId', orgsController.deleteOrg);

routes.get('/describe', ensureOrgExists, sfQueryController.describe);
routes.get('/describe/:sobject', ensureOrgExists, sfQueryController.describeSObject);
routes.post('/query', ensureOrgExists, sfQueryController.query);
routes.get('/query-more', ensureOrgExists, sfQueryController.queryMore);

routes.post('/record/:operation/:sobject', ensureOrgExists, sfMiscController.recordOperation);

routes.post('/request', ensureOrgExists, sfMiscController.makeJsforceRequest);

export default routes;
