import { Router } from 'tiny-request-router';
import { handleJsonResponse, RequestOptions } from '../utils/route.utils';
import { routeDefinition as dataSyncController } from './jetstream-data-sync.desktop.controller';
import { routeDefinition as jetstreamOrganizationsController } from './jetstream-orgs.desktop.controller';
import { routeDefinition as orgsController } from './orgs.desktop.controller';
import { routeDefinition as bulkApiController } from './sf-bulk-api.desktop.controller';
import { routeDefinition as bulkQuery20ApiController } from './sf-bulk-query-20-api.desktop.controller';
import { routeDefinition as metadataToolingController } from './sf-metadata-tooling.desktop.controller';
import { routeDefinition as miscController } from './sf-misc.desktop.controller';
import { routeDefinition as queryController } from './sf-query.desktop.controller';
import { routeDefinition as recordController } from './sf-record.desktop.controller';
import { routeDefinition as userController } from './user.desktop.controller';

const router = new Router<(req: RequestOptions) => Promise<Response>>();
export const desktopRoutes = router;

router.get('/api/heartbeat', async (req) => {
  return handleJsonResponse({ version: 'unknown' });
});
router.get('/api/me', userController.getUserProfile.controllerFn());
router.get('/api/me/profile', userController.getFullUserProfile.controllerFn());
router.post('/api/me/profile', userController.updateProfile.controllerFn());

/**
 * ************************************
 * Data History Sync Routes
 * ************************************
 */
router.get('/api/data-sync/pull', dataSyncController.pull.controllerFn());
router.post('/api/data-sync/push', dataSyncController.push.controllerFn());

/**
 * ************************************
 * orgsController Routes
 * ************************************
 */
router.post('/api/orgs/health-check', orgsController.checkOrgHealth.controllerFn());
router.get('/api/orgs', orgsController.getOrgs.controllerFn());
router.patch('/api/orgs/:uniqueId', orgsController.updateOrg.controllerFn());
router.delete('/api/orgs/:uniqueId', orgsController.deleteOrg.controllerFn());
router.put('/api/orgs/:uniqueId/move', orgsController.moveOrg.controllerFn());

router.get('/api/jetstream-organizations', jetstreamOrganizationsController.getOrganizations.controllerFn());
router.post('/api/jetstream-organizations', jetstreamOrganizationsController.createOrganization.controllerFn());
router.put('/api/jetstream-organizations/:id', jetstreamOrganizationsController.updateOrganization.controllerFn());
router.delete('/api/jetstream-organizations/:id', jetstreamOrganizationsController.deleteOrganization.controllerFn());

/**
 * ************************************
 * queryController Routes
 * ************************************
 */
router.get('/api/describe', queryController.describe.controllerFn());
router.get('/api/describe/:sobject', queryController.describeSObject.controllerFn());
router.post('/api/query', queryController.query.controllerFn());
router.get('/api/query-more', queryController.queryMore.controllerFn());

/**
 * ************************************
 * metadataToolingController Routes
 * ************************************
 */
router.get('/api/metadata/describe', metadataToolingController.describeMetadata.controllerFn());
router.post('/api/metadata/list', metadataToolingController.listMetadata.controllerFn());
router.post('/api/metadata/read/:type', metadataToolingController.readMetadata.controllerFn());
router.post('/api/metadata/deploy', metadataToolingController.deployMetadata.controllerFn());
// Content-Type=Application/zip
router.post('/api/metadata/deploy-zip', metadataToolingController.deployMetadataZip.controllerFn());
router.get('/api/metadata/deploy/:id', metadataToolingController.checkMetadataResults.controllerFn());
router.post('/api/metadata/retrieve/list-metadata', metadataToolingController.retrievePackageFromLisMetadataResults.controllerFn());
router.post('/api/metadata/retrieve/package-names', metadataToolingController.retrievePackageFromExistingServerPackages.controllerFn());
router.post('/api/metadata/retrieve/manifest', metadataToolingController.retrievePackageFromManifest.controllerFn());
router.get('/api/metadata/retrieve/check-results', metadataToolingController.checkRetrieveStatus.controllerFn());
// ensureTargetOrgExists,
router.post('/api/metadata/retrieve/check-and-redeploy', metadataToolingController.checkRetrieveStatusAndRedeploy.controllerFn());
router.post('/api/metadata/package-xml', metadataToolingController.getPackageXml.controllerFn());
router.post('/api/apex/anonymous', metadataToolingController.anonymousApex.controllerFn());
router.get('/api/apex/completions/:type', metadataToolingController.apexCompletions.controllerFn());

/**
 * ************************************
 * miscController Routes
 * ************************************
 */
router.get('/api/file/stream-download', miscController.streamFileDownload.controllerFn());
router.post('/api/request', miscController.salesforceRequest.controllerFn());
router.post('/api/request-manual', miscController.salesforceRequestManual.controllerFn());

/**
 * ************************************
 * recordController Routes
 * ************************************
 */
router.post('/api/record/:operation/:sobject', recordController.recordOperation.controllerFn());

/**
 * ************************************
 * bulkApiController Routes
 * ************************************
 */
router.post('/api/bulk', bulkApiController.createJob.controllerFn());
router.get('/api/bulk/:jobId', bulkApiController.getJob.controllerFn());
router.delete('/api/bulk/:jobId/:action', bulkApiController.closeOrAbortJob.controllerFn());
router.post('/api/bulk/:jobId', bulkApiController.addBatchToJob.controllerFn());
router.post('/api/bulk/zip/:jobId', bulkApiController.addBatchToJobWithBinaryAttachment.controllerFn());
router.get('/api/bulk/:jobId/:batchId', bulkApiController.downloadResults.controllerFn());

/**
 * ************************************
 * bulkQuery20ApiController Routes
 * These use the Bulk Query 2.0 API
 * ************************************
 */
router.post('/api/bulk-query', bulkQuery20ApiController.createJob.controllerFn());
router.get('/api/bulk-query', bulkQuery20ApiController.getJobs.controllerFn());
router.get('/api/bulk-query/:jobId/results', bulkQuery20ApiController.downloadResults.controllerFn());
router.get('/api/bulk-query/:jobId', bulkQuery20ApiController.getJob.controllerFn());
router.post('/api/bulk-query/:jobId/abort', bulkQuery20ApiController.abortJob.controllerFn());
router.delete('/api/bulk-query/:jobId', bulkQuery20ApiController.deleteJob.controllerFn());
