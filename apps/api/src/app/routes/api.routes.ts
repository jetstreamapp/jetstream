import { ENV } from '@jetstream/api-config';
import { getDefaultAppState } from '@jetstream/shared/utils';
import { AppInfo } from '@jetstream/types';
import express, { Router } from 'express';
import { getAnnouncements } from '../announcements';
import { routeDefinition as dataSyncController } from '../controllers/data-sync.controller';
import { routeDefinition as orgGroupController } from '../controllers/org-groups.controller';
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
import { addOrgsToLocal, checkAuth, ensureTargetOrgExists, validateDoubleCSRF, verifyEntitlement } from './route.middleware';

const routes: express.Router = Router();

routes.use(checkAuth);
routes.use(validateDoubleCSRF);
routes.use(addOrgsToLocal);

// used to make sure the user is authenticated and can communicate with the server
routes.get('/heartbeat', (req: express.Request, res: express.Response) => {
  const result: AppInfo = {
    version: ENV.VERSION || 'unknown',
    announcements: getAnnouncements(),
    appInfo: getDefaultAppState({
      serverUrl: ENV.JETSTREAM_SERVER_URL,
      environment: ENV.ENVIRONMENT,
      defaultApiVersion: `v${ENV.SFDC_API_VERSION}`,
      google_appId: ENV.GOOGLE_APP_ID || 'unset',
      google_apiKey: ENV.GOOGLE_API_KEY || 'unset',
      google_clientId: ENV.GOOGLE_CLIENT_ID || 'unset',
    }),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendJson(res as any, result);
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
routes.get('/me/profile/sessions', userController.getSessions.controllerFn());
routes.delete('/me/profile/sessions/:id', userController.revokeSession.controllerFn());
routes.delete('/me/profile/sessions', userController.revokeAllSessions.controllerFn());
/**
 * Password Management Routes
 */
routes.post('/me/profile/password/init', userController.initPassword.controllerFn());
routes.post('/me/profile/password/reset', userController.initResetPassword.controllerFn());
// TODO: should we allow users to remove their password if they have social login?
routes.delete('/me/profile/password', userController.deletePassword.controllerFn());
/**
 * 2FA Routes
 */
routes.get('/me/profile/login-configuration', userController.getUserLoginConfiguration.controllerFn());
routes.get('/me/profile/2fa-otp', userController.getOtpQrCode.controllerFn());
routes.post('/me/profile/2fa-otp', userController.saveOtpAuthFactor.controllerFn());
routes.post('/me/profile/2fa/:type/:action', userController.toggleEnableDisableAuthFactor.controllerFn());
routes.delete('/me/profile/2fa/:type', userController.deleteAuthFactor.controllerFn());

/**
 * ************************************
 * Data History Sync Routes
 * ************************************
 */
routes.get('/data-sync/pull', verifyEntitlement('recordSync'), dataSyncController.pull.controllerFn());
routes.post('/data-sync/push', verifyEntitlement('recordSync'), dataSyncController.push.controllerFn());

/**
 * ************************************
 * orgsController Routes
 * ************************************
 */
routes.post('/orgs/health-check', orgsController.checkOrgHealth.controllerFn());
routes.get('/orgs', orgsController.getOrgs.controllerFn());
routes.patch('/orgs/:uniqueId', orgsController.updateOrg.controllerFn());
routes.delete('/orgs/:uniqueId', orgsController.deleteOrg.controllerFn());
routes.put('/orgs/:uniqueId/move', orgsController.moveOrg.controllerFn());

// DEPRECATED - /orgs/groups (remove this after some time)
routes.get('/jetstream-organizations', orgGroupController.getOrganizations.controllerFn());
routes.post('/jetstream-organizations', orgGroupController.createOrganization.controllerFn());
routes.put('/jetstream-organizations/:id', orgGroupController.updateOrganization.controllerFn());
routes.delete('/jetstream-organizations/:id', orgGroupController.deleteOrganization.controllerFn());

routes.get('/orgs/groups', orgGroupController.getOrganizations.controllerFn());
routes.post('/orgs/groups', orgGroupController.createOrganization.controllerFn());
routes.put('/orgs/groups/:id', orgGroupController.updateOrganization.controllerFn());
routes.delete('/orgs/groups/:id', orgGroupController.deleteOrganization.controllerFn());
routes.delete('/orgs/groups/:id/with-orgs', orgGroupController.deleteOrganizationWithOrgs.controllerFn());

/**
 * ************************************
 * imageController Routes
 * ************************************
 * Deprecated - re-implement if required - review this commit for prior implementation
 */
// routes.get('/images/upload-signature', imageController.getUploadSignature.controllerFn());

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
  metadataToolingController.checkRetrieveStatusAndRedeploy.controllerFn(),
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
routes.get('/file/stream-download/zip', miscController.streamFileDownloadToZip.controllerFn());
routes.post('/request', miscController.salesforceRequest.controllerFn());
routes.post('/request-manual', miscController.salesforceRequestManual.controllerFn());

/**
 * ************************************
 * recordController Routes
 * ************************************
 */
// handle multipart/form-data for binary uploads
routes.post('/record/upload', recordController.binaryUpload.controllerFn());
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
routes.get('/bulk/download-all/:jobId', bulkApiController.downloadAllResults.controllerFn());
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
