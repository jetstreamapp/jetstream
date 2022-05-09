import { HTTP } from '@jetstream/shared/constants';
import { MapOf } from '@jetstream/types';
import findMyWay, { HTTPMethod } from 'find-my-way';
import * as jsforce from 'jsforce';
import * as appController from './controllers/app.controller';
import * as salesforceController from './controllers/salesforce.controller';
import { ENV } from './env';
import { getOrgs, updateOrg } from './storage';
import { ElectronRequest, ElectronRequestData, SalesforceOrgElectron } from './types';

const router = findMyWay();

router.on('GET', '/api/heartbeat', appController.placeholder);

router.on('GET', '/api/me', appController.getUserProfile);
router.on('DELETE', '/api/me', appController.placeholder);

router.on('GET', '/api/me/profile', appController.placeholder);
router.on('POST', '/api/me/profile', appController.placeholder);
router.on('DELETE', '/api/me/profile/identity', appController.placeholder);

router.on('GET', '/api/orgs', appController.handleGetOrgs);
router.on('PATCH', '/api/orgs/:uniqueId', appController.placeholder);
router.on('DELETE', '/api/orgs/:uniqueId', appController.placeholder);

router.on('GET', '/api/images/upload-signature', appController.placeholder);
router.on('POST', '/api/feedback/submit', appController.placeholder);

router.on('GET', '/api/describe', salesforceController.handleGlobalDescribe);
router.on('GET', '/api/describe/:sobject', salesforceController.handleDescribeSobject);

router.on('POST', '/api/query', salesforceController.query);
router.on('GET', '/api/query-more', salesforceController.queryMore);

router.on('POST', '/api/record/:operation/:sobject', appController.placeholder);
router.on('GET', '/api/metadata/describe', appController.placeholder);
router.on('POST', '/api/bulk', appController.placeholder);
router.on('GET', '/api/bulk/:jobId', appController.placeholder);
router.on('DELETE', '/api/bulk/:jobId', appController.placeholder);
router.on('POST', '/api/bulk/:jobId', appController.placeholder);
router.on('POST', '/api/me/profile/identity/verify-email', appController.placeholder);
router.on('GET', '/api/file/stream-download', appController.placeholder);
router.on('POST', '/api/metadata/list', appController.placeholder);
router.on('POST', '/api/metadata/read/:type', appController.placeholder);
router.on('POST', '/api/metadata/deploy', appController.placeholder);
router.on('POST', '/api/metadata/deploy-zip', appController.placeholder);
router.on('GET', '/api/metadata/deploy/:id', appController.placeholder);
router.on('POST', '/api/metadata/retrieve/list-metadata', appController.placeholder);
router.on('POST', '/api/metadata/retrieve/package-names', appController.placeholder);
router.on('POST', '/api/metadata/retrieve/manifest', appController.placeholder);
router.on('GET', '/api/metadata/retrieve/check-results', appController.placeholder);
router.on('POST', '/api/metadata/retrieve/check-and-redeploy', appController.placeholder);
router.on('POST', '/api/metadata/package-xml', appController.placeholder);
router.on('POST', '/api/request', appController.placeholder);
router.on('POST', '/api/request-manual', appController.placeholder);
router.on('POST', '/api/bulk/zip/:jobId', appController.placeholder);
router.on('GET', '/api/bulk/:jobId/:batchId', appController.placeholder);
router.on('POST', '/api/apex/anonymous', appController.placeholder);
router.on('GET', '/api/apex/completions/:type', appController.placeholder);
router.on('GET', '/api/salesforce-api/requests', appController.placeholder);

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
    let connection: jsforce.Connection;
    if (!route) {
      // TODO: should we encode differently?
      return reject(new Error('Route not found'));
    }

    const orgId = getHeader(headers, HTTP.HEADERS.X_SFDC_ID);
    if (orgId) {
      const org = (await getOrgs()).find(({ uniqueId }) => uniqueId === orgId);
      if (!org) {
        return reject(new Error(`Org with provided id does not exist`));
      }
      connection = getConnectionFromRequest(org, false);
    }

    const request: ElectronRequest = {
      resolve,
      reject,
      connection,
      request: requestData,
    };

    route.handler(null, null, route.params, request);
  });
}

function getConnectionFromRequest(org: SalesforceOrgElectron, includeCallOptions?: boolean) {
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
    version: org.apiVersion || ENV.SFDC_FALLBACK_API_VERSION,
    callOptions: {},
  };

  if (org.orgNamespacePrefix && includeCallOptions) {
    connData.callOptions = { ...connData.callOptions, defaultNamespace: org.orgNamespacePrefix };
  }

  const conn = new jsforce.Connection(connData);

  const handleRefresh = async (accessToken, res) => {
    try {
      await updateOrg({ ...org, accessToken, refreshToken: conn.refreshToken });
      console.info('[ORG][REFRESH] Org refreshed successfully');
    } catch (ex) {
      console.error('[ORG][REFRESH] Error saving refresh token', ex);
    }
  };

  conn.on('refresh', handleRefresh);

  return conn;
}
