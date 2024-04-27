import { ENV } from '@jetstream/api-config';
import express from 'express';
import Router from 'express-promise-router';
import multer from 'multer';
import { routeDefinition as imageController } from '../controllers/image.controller';
import { routeDefinition as orgsController } from '../controllers/orgs.controller';
import { routeDefinition as salesforceApiReqController } from '../controllers/salesforce-api-requests.controller';
import { routeDefinition as bulkApiController } from '../controllers/sf-bulk-api.controller';
import { routeDefinition as bulkQuery20ApiController } from '../controllers/sf-bulk-query-20-api.controller';
import { routeDefinition as metadataToolingController } from '../controllers/sf-metadata-tooling.controller';
import { routeDefinition as miscController } from '../controllers/sf-misc.controller';
import { routeDefinition as queryController } from '../controllers/sf-query.controller';
import { routeDefinition as recordController } from '../controllers/sf-record.controller';
import { routeDefinition as userController } from '../controllers/user.controller';
import { sendJson } from '../utils/response.handlers';
import { addOrgsToLocal, checkAuth, ensureTargetOrgExists } from './route.middleware';

const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

const routes: express.Router = Router();

routes.use(checkAuth);
routes.use(addOrgsToLocal);

// used to make sure the user is authenticated and can communicate with the server
routes.get('/heartbeat', (req: express.Request, res: express.Response) => {
  sendJson(res, { version: ENV.GIT_VERSION || null });
});

/**
 * ************************************
 * userController Routes
 * ************************************
 */
routes.get('/me', userController.getUserProfile.controllerFn());
routes.delete('/me', userController.deleteAccount.controllerFn());
routes.get('/me/profile', userController.getFullUserProfile.controllerFn());
routes.post('/me/profile', userController.updateProfile.controllerFn());
routes.delete('/me/profile/identity', userController.unlinkIdentity.controllerFn());
routes.post('/me/profile/identity/verify-email', userController.resendVerificationEmail.controllerFn());
routes.post('/support/email', upload.array('files', 5) as any, userController.emailSupport.controllerFn());

/**
 * ************************************
 * orgsController Routes
 * ************************************
 */
routes.post('/orgs/health-check', orgsController.checkOrgHealth.controllerFn());
routes.get('/orgs', orgsController.getOrgs.controllerFn());
routes.patch('/orgs/:uniqueId', orgsController.updateOrg.controllerFn());
routes.delete('/orgs/:uniqueId', orgsController.deleteOrg.controllerFn());

/**
 * ************************************
 * imageController Routes
 * ************************************
 */
routes.get('/images/upload-signature', imageController.getUploadSignature.controllerFn());

/**
 * ************************************
 * queryController Routes
 * ************************************
 */
routes.get('/describe', queryController.describe.controllerFn());
routes.get('/describe/:sobject', queryController.describeSObject.controllerFn());
routes.post('/query', queryController.query.controllerFn());
routes.get('/query-more', queryController.queryMore.controllerFn());

/**
 * ************************************
 * metadataToolingController Routes
 * ************************************
 */
routes.get('/metadata/describe', metadataToolingController.describeMetadata.controllerFn());
routes.post('/metadata/list', metadataToolingController.listMetadata.controllerFn());
routes.post('/metadata/read/:type', metadataToolingController.readMetadata.controllerFn());
routes.post('/metadata/deploy', metadataToolingController.deployMetadata.controllerFn());
// Content-Type=Application/zip
routes.post('/metadata/deploy-zip', metadataToolingController.deployMetadataZip.controllerFn());
routes.get('/metadata/deploy/:id', metadataToolingController.checkMetadataResults.controllerFn());
routes.post('/metadata/retrieve/list-metadata', metadataToolingController.retrievePackageFromLisMetadataResults.controllerFn());
routes.post('/metadata/retrieve/package-names', metadataToolingController.retrievePackageFromExistingServerPackages.controllerFn());
routes.post('/metadata/retrieve/manifest', metadataToolingController.retrievePackageFromManifest.controllerFn());
routes.get('/metadata/retrieve/check-results', metadataToolingController.checkRetrieveStatus.controllerFn());
routes.post(
  '/metadata/retrieve/check-and-redeploy',
  ensureTargetOrgExists,
  metadataToolingController.checkRetrieveStatusAndRedeploy.controllerFn()
);
routes.post('/metadata/package-xml', metadataToolingController.getPackageXml.controllerFn());
routes.post('/apex/anonymous', metadataToolingController.anonymousApex.controllerFn());
routes.get('/apex/completions/:type', metadataToolingController.apexCompletions.controllerFn());

/**
 * ************************************
 * miscController Routes
 * ************************************
 */
routes.get('/file/stream-download', miscController.streamFileDownload.controllerFn());
routes.post('/request', miscController.salesforceRequest.controllerFn());
routes.post('/request-manual', miscController.salesforceRequestManual.controllerFn());

/**
 * ************************************
 * recordController Routes
 * ************************************
 */
routes.post('/record/:operation/:sobject', recordController.recordOperation.controllerFn());

/**
 * ************************************
 * bulkApiController Routes
 * ************************************
 */
routes.post('/bulk', bulkApiController.createJob.controllerFn());
routes.get('/bulk/:jobId', bulkApiController.getJob.controllerFn());
routes.delete('/bulk/:jobId/:action', bulkApiController.closeOrAbortJob.controllerFn());
routes.post('/bulk/:jobId', bulkApiController.addBatchToJob.controllerFn());
routes.post('/bulk/zip/:jobId', bulkApiController.addBatchToJobWithBinaryAttachment.controllerFn());
routes.get('/bulk/:jobId/:batchId', bulkApiController.downloadResults.controllerFn());

/**
 * ************************************
 * bulkQuery20ApiController Routes
 * These use the Bulk Query 2.0 API
 * ************************************
 */
routes.post('/bulk-query', bulkQuery20ApiController.createJob.controllerFn());
routes.get('/bulk-query', bulkQuery20ApiController.getJobs.controllerFn());
routes.get('/bulk-query/:jobId/results', bulkQuery20ApiController.downloadResults.controllerFn());
routes.get('/bulk-query/:jobId', bulkQuery20ApiController.getJob.controllerFn());
routes.post('/bulk-query/:jobId/abort', bulkQuery20ApiController.abortJob.controllerFn());
routes.delete('/bulk-query/:jobId', bulkQuery20ApiController.deleteJob.controllerFn());

/**
 * ************************************
 * salesforceApiReqController Routes
 * ************************************
 */
routes.get('/salesforce-api/requests', salesforceApiReqController.getSalesforceApiRequests.controllerFn());

export default routes;
