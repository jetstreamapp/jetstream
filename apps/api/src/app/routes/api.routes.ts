import * as express from 'express';
import Router from 'express-promise-router';
import * as orgsController from '../controllers/orgs.controller';
import * as bulkApiController from '../controllers/sf-bulk-api.controller';
import * as metadataToolingController from '../controllers/sf-metadata-tooling.controller';
import * as sfMiscController from '../controllers/sf-misc.controller';
import * as sfQueryController from '../controllers/sf-query.controller';
import * as userController from '../controllers/user.controller';
import { addOrgsToLocal, checkAuth, ensureOrgExists, ensureTargetOrgExists, validate } from './route.middleware';
import { sendJson } from '../utils/response.handlers';

const routes: express.Router = Router();

routes.use(checkAuth); // NOTE: all routes here must be authenticated
routes.use(addOrgsToLocal);

// used to make sure the user is authenticated and can communicate with the server
routes.get('/heartbeat', (req: express.Request, res: express.Response) => {
  sendJson(res, { version: process.env.GIT_VERSION || null });
});

routes.get('/me', userController.getUserProfile);

routes.get('/orgs', orgsController.getOrgs);
routes.patch('/orgs/:uniqueId', orgsController.updateOrg);
routes.delete('/orgs/:uniqueId', orgsController.deleteOrg);

routes.get('/describe', ensureOrgExists, sfQueryController.describe);
routes.get('/describe/:sobject', ensureOrgExists, sfQueryController.describeSObject);
routes.post('/query', ensureOrgExists, validate(sfQueryController.routeValidators.query), sfQueryController.query);
routes.get('/query-more', ensureOrgExists, validate(sfQueryController.routeValidators.queryMore), sfQueryController.queryMore);

routes.post('/record/:operation/:sobject', ensureOrgExists, sfMiscController.recordOperation);

routes.get('/metadata/describe', ensureOrgExists, metadataToolingController.describeMetadata);
routes.post(
  '/metadata/list',
  ensureOrgExists,
  validate(metadataToolingController.routeValidators.listMetadata),
  metadataToolingController.listMetadata
);
routes.post(
  '/metadata/read/:type',
  ensureOrgExists,
  validate(metadataToolingController.routeValidators.readMetadata),
  metadataToolingController.readMetadata
);

routes.post(
  '/metadata/deploy',
  ensureOrgExists,
  validate(metadataToolingController.routeValidators.deployMetadata),
  metadataToolingController.deployMetadata
);

// Content-Type=Application/zip
routes.post(
  '/metadata/deploy-zip',
  ensureOrgExists,
  validate(metadataToolingController.routeValidators.deployMetadataZip),
  metadataToolingController.deployMetadataZip
);

routes.get(
  '/metadata/deploy/:id',
  ensureOrgExists,
  validate(metadataToolingController.routeValidators.checkMetadataResults),
  metadataToolingController.checkMetadataResults
);

routes.post(
  '/metadata/retrieve/list-metadata',
  ensureOrgExists,
  metadataToolingController.routeValidators.retrievePackageFromLisMetadataResults,
  metadataToolingController.retrievePackageFromLisMetadataResults
);
routes.post(
  '/metadata/retrieve/package-names',
  ensureOrgExists,
  metadataToolingController.routeValidators.retrievePackageFromExistingServerPackages,
  metadataToolingController.retrievePackageFromExistingServerPackages
);
routes.post(
  '/metadata/retrieve/manifest',
  ensureOrgExists,
  metadataToolingController.routeValidators.retrievePackageFromManifest,
  metadataToolingController.retrievePackageFromManifest
);
routes.get(
  '/metadata/retrieve/check-results',
  ensureOrgExists,
  metadataToolingController.routeValidators.checkRetrieveStatus,
  metadataToolingController.checkRetrieveStatus
);

routes.post(
  '/metadata/retrieve/check-and-redeploy',
  ensureOrgExists,
  ensureTargetOrgExists,
  metadataToolingController.routeValidators.checkRetrieveStatusAndRedeploy,
  metadataToolingController.checkRetrieveStatusAndRedeploy
);

routes.post(
  '/metadata/package-xml',
  ensureOrgExists,
  validate(metadataToolingController.routeValidators.getPackageXml),
  metadataToolingController.getPackageXml
);

routes.post(
  '/request',
  ensureOrgExists,
  validate(sfMiscController.routeValidators.makeJsforceRequest),
  sfMiscController.makeJsforceRequest
);

routes.post(
  '/request-manual',
  ensureOrgExists,
  validate(sfMiscController.routeValidators.makeJsforceRequestViaAxios),
  sfMiscController.makeJsforceRequestViaAxios
);

routes.post('/bulk', ensureOrgExists, validate(bulkApiController.routeValidators.createJob), bulkApiController.createJob);
routes.get('/bulk/:jobId', ensureOrgExists, validate(bulkApiController.routeValidators.getJob), bulkApiController.getJob);
routes.delete('/bulk/:jobId', ensureOrgExists, validate(bulkApiController.routeValidators.closeJob), bulkApiController.closeJob);
routes.post('/bulk/:jobId', ensureOrgExists, validate(bulkApiController.routeValidators.addBatchToJob), bulkApiController.addBatchToJob);
routes.get(
  '/bulk/:jobId/:batchId',
  ensureOrgExists,
  validate(bulkApiController.routeValidators.downloadResults),
  bulkApiController.downloadResults
);

routes.post(
  '/apex/anonymous',
  ensureOrgExists,
  validate(metadataToolingController.routeValidators.anonymousApex),
  metadataToolingController.anonymousApex
);

routes.get(
  '/apex/completions/:type',
  ensureOrgExists,
  validate(metadataToolingController.routeValidators.apexCompletions),
  metadataToolingController.apexCompletions
);

export default routes;
