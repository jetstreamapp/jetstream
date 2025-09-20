import { ENV } from '@jetstream/api-config';
import express, { Router } from 'express';
import { getAnnouncements } from '../announcements';
import { routeDefinition as billingController } from '../controllers/billing.controller';
import { routeDefinition as dataSyncController } from '../controllers/data-sync.controller';
import { routeDefinition as imageController } from '../controllers/image.controller';
import { routeDefinition as jetstreamOrganizationsController } from '../controllers/jetstream-organizations.controller';
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  sendJson(res as any, { version: ENV.VERSION || null, announcements: getAnnouncements() });
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
 * Billing Routes
 * ************************************
 */
routes.post('/billing/checkout-session', billingController.createCheckoutSession.controllerFn());
routes.get('/billing/checkout-session/complete', billingController.processCheckoutSuccess.controllerFn());
routes.get('/billing/subscriptions', billingController.getSubscriptions.controllerFn());
routes.post('/billing/portal', billingController.createBillingPortalSession.controllerFn());

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

routes.get('/jetstream-organizations', jetstreamOrganizationsController.getOrganizations.controllerFn());
routes.post('/jetstream-organizations', jetstreamOrganizationsController.createOrganization.controllerFn());
routes.put('/jetstream-organizations/:id', jetstreamOrganizationsController.updateOrganization.controllerFn());
routes.delete('/jetstream-organizations/:id', jetstreamOrganizationsController.deleteOrganization.controllerFn());

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
