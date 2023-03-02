import { HTTP } from '@jetstream/shared/constants';
import { MapOf } from '@jetstream/types';
import findMyWay, { HTTPMethod } from 'find-my-way';
import * as jsforce from 'jsforce';
import { isString } from 'lodash';
import * as appController from './controllers/app.controller';
import * as salesforceController from './controllers/salesforce.controller';
import * as salesforceApiController from './controllers/salesforce-api.controller';
import { ENV } from './env';
import { getOrgs, updateOrg } from './storage';
import { ElectronRequest, ElectronRequestData, SalesforceOrgElectron } from './types';

const router = findMyWay({ caseSensitive: false });

router.on('GET', '/api/heartbeat', appController.heartbeat);

router.on('GET', '/api/me', appController.getUserProfile);
// router.on('DELETE', '/api/me', appController.placeholder); // TODO:

// router.on('GET', '/api/me/profile', appController.placeholder); // TODO:
// router.on('POST', '/api/me/profile', appController.placeholder); // TODO:
// router.on('DELETE', '/api/me/profile/identity', appController.placeholder); // TODO:

router.on('GET', '/api/orgs', appController.handleGetOrgs);
router.on('PATCH', '/api/orgs/:uniqueId', appController.handleUpdateOrg);
router.on('DELETE', '/api/orgs/:uniqueId', appController.handleDeleteOrg);

router.on('GET', '/api/images/upload-signature', appController.placeholder); // TODO:
router.on('POST', '/api/feedback/submit', appController.placeholder); // TODO:

router.on('GET', '/api/describe', salesforceController.handleGlobalDescribe);
router.on('GET', '/api/describe/:sobject', salesforceController.handleDescribeSobject);

router.on('POST', '/api/query', salesforceController.query);
router.on('GET', '/api/query-more', salesforceController.queryMore);

router.on('POST', '/api/record/:operation/:sobject', salesforceController.recordOperation);
router.on('GET', '/api/metadata/describe', salesforceController.describeMetadata);

router.on('POST', '/api/metadata/list', salesforceController.listMetadata);
router.on('POST', '/api/metadata/read/:type', salesforceController.readMetadata);
router.on('POST', '/api/metadata/deploy', salesforceController.deployMetadata);
router.on('POST', '/api/metadata/deploy-zip', salesforceController.deployMetadataZip);
router.on('GET', '/api/metadata/deploy/:id', salesforceController.checkMetadataResults);

// router.on('POST', '/api/me/profile/identity/verify-email', appController.placeholder); // TODO:
router.on('GET', '/api/file/stream-download', appController.placeholder); // TODO:

router.on('POST', '/api/metadata/retrieve/list-metadata', salesforceController.retrievePackageFromLisMetadataResults);
router.on('POST', '/api/metadata/retrieve/package-names', salesforceController.retrievePackageFromExistingServerPackages);
router.on('POST', '/api/metadata/retrieve/manifest', salesforceController.retrievePackageFromManifest);
router.on('GET', '/api/metadata/retrieve/check-results', salesforceController.checkRetrieveStatus);
router.on('POST', '/api/metadata/retrieve/check-and-redeploy', salesforceController.checkRetrieveStatusAndRedeploy);
router.on('POST', '/api/metadata/package-xml', salesforceController.getPackageXml);
router.on('POST', '/api/request', salesforceController.makeJsforceRequest);
router.on('POST', '/api/request-manual', salesforceController.makeJsforceRequestViaNode);

router.on('POST', '/api/bulk', salesforceController.createJob);
router.on('GET', '/api/bulk/:jobId', salesforceController.getJob);
router.on('DELETE', '/api/bulk/:jobId', salesforceController.closeJob);
router.on('POST', '/api/bulk/:jobId', salesforceController.addBatchToJob);
router.on('POST', '/api/bulk/zip/:jobId', salesforceController.addBatchToJobWithBinaryAttachment);
router.on('GET', '/api/bulk/:jobId/:batchId', salesforceController.downloadBulkApiResults);

router.on('POST', '/api/apex/anonymous', salesforceController.executeAnonymousApex);
router.on('GET', '/api/apex/completions/:type', salesforceController.apexCompletions);
router.on('GET', '/api/salesforce-api/requests', salesforceApiController.getSalesforceApiExamples);

function getHeader(headers: MapOf<string>, header: string) {
  if (!headers || !header) {
    return null;
  }
  if (headers[header]) {
    return headers[header];
  }
  if (headers[header.toLowerCase()]) {
    return headers[header.toLowerCase()];
  }
  const headerMap = new Map();
  Object.keys(headers || {}).forEach((key) => headerMap.set(key.toLowerCase(), headers[key]));
  if (headerMap.has(header.toLowerCase())) {
    return headerMap.get(header.toLowerCase());
  }
  return null;
}

export function handleRequest(path: string, requestData: ElectronRequestData) {
  const { method, headers } = requestData;
  // eslint-disable-next-line no-async-promise-executor
  return new Promise(async (resolve, reject) => {
    const route = router.find(method.toUpperCase() as HTTPMethod, path);
    let connection: jsforce.Connection | undefined;
    let targetConnection: jsforce.Connection | undefined;
    if (!route) {
      return reject(new Error('Route not found'));
    }

    const orgId = getHeader(headers, HTTP.HEADERS.X_SFDC_ID);
    if (orgId) {
      const org = (await getOrgs()).find(({ uniqueId }) => uniqueId === orgId);
      if (!org) {
        return reject(new Error(`Org with provided id does not exist`));
      }
      connection = getJsforceConnection(org, false);
    }

    const targetOrgId = getHeader(headers, HTTP.HEADERS.X_SFDC_ID_TARGET);
    if (targetOrgId) {
      const org = (await getOrgs()).find(({ uniqueId }) => uniqueId === targetOrgId);
      if (!org) {
        return reject(new Error(`Org with provided id does not exist`));
      }
      targetConnection = getJsforceConnection(org, false);
    }

    const request: ElectronRequest = {
      resolve,
      reject,
      connection,
      targetConnection,
      request: requestData,
    };

    if (isString(requestData.data)) {
      try {
        requestData.data = JSON.parse(requestData.data);
      } catch (ex) {
        // e.x. CSV payloads still come through here
        console.log('Failed to parse as JSON');
      }
    }

    route.handler(null as any, null as any, route.params, request);
  });
}

export function getJsforceConnection(org: SalesforceOrgElectron, includeCallOptions = false) {
  const connData: jsforce.ConnectionOptions = {
    oauth2: new jsforce.OAuth2({
      loginUrl: org.instanceUrl,
      clientId: ENV.SFDC_CLIENT_ID,
      redirectUri: 'http://localhost/oauth/sfdc/callback',
    }),
    instanceUrl: org.instanceUrl,
    accessToken: org.accessToken,
    refreshToken: org.refreshToken,
    maxRequest: 5,
    version: org.apiVersion || ENV.sfdcFallbackApiVersion,
    callOptions: {},
  };

  if (org.orgNamespacePrefix && includeCallOptions) {
    connData.callOptions = { ...connData.callOptions, defaultNamespace: org.orgNamespacePrefix } as any;
  }

  const conn = new jsforce.Connection(connData);

  const handleRefresh = async (accessToken, res) => {
    try {
      await updateOrg(org.uniqueId, { ...org, accessToken, refreshToken: conn.refreshToken });
      console.info('[ORG][REFRESH] Org refreshed successfully');
    } catch (ex) {
      console.error('[ORG][REFRESH] Error saving refresh token', ex);
    }
  };

  conn.on('refresh', handleRefresh);

  return conn;
}
