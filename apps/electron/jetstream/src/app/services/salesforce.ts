import { getMapOf } from '@jetstream/shared/utils';
import { MapOf, SalesforceOrgUi } from '@jetstream/types';
import jsforce from 'jsforce';
import fetch from 'node-fetch';
import { PassThrough } from 'stream';
import { environment } from '../../environments/environment';

export interface SalesforceOrgElectron extends SalesforceOrgUi {
  accessToken: string;
  refreshToken: string;
}

let _orgs: SalesforceOrgElectron[] = [];
let _orgsById: MapOf<SalesforceOrgElectron> = {};

export function getOrgs() {
  return _orgs;
}

export function getOrg(uniqueId: string) {
  return _orgsById[uniqueId];
}

export function setOrgs(orgs: SalesforceOrgElectron[]) {
  _orgs = orgs;
  _orgsById = getMapOf(orgs, 'uniqueId');
}

export function getJsforceConnection(uniqueId: string, includeCallOptions = false) {
  const org = _orgsById[uniqueId];
  const connData: jsforce.ConnectionOptions = {
    oauth2: new jsforce.OAuth2({
      loginUrl: org.instanceUrl,
      clientId: environment.SFDC_CLIENT_ID,
      redirectUri: 'http://localhost/oauth/sfdc/callback',
    }),
    instanceUrl: org.instanceUrl,
    accessToken: org.accessToken,
    refreshToken: org.refreshToken,
    maxRequest: 5,
    version: org.apiVersion || environment.sfdcFallbackApiVersion,
    callOptions: {},
  };

  if (org.orgNamespacePrefix && includeCallOptions) {
    connData.callOptions = { ...connData.callOptions, defaultNamespace: org.orgNamespacePrefix };
  }

  const conn = new jsforce.Connection(connData);

  // TODO:
  // const handleRefresh = async (accessToken, res) => {
  //   try {
  //     await updateOrg(org.uniqueId, { ...org, accessToken, refreshToken: conn.refreshToken });
  //     console.info('[ORG][REFRESH] Org refreshed successfully');
  //   } catch (ex) {
  //     console.error('[ORG][REFRESH] Error saving refresh token', ex);
  //   }
  // };

  // conn.on('refresh', handleRefresh);

  return conn;
}

/**
 * Stream a file download from Salesforce
 * Query parameter of url is required (e.x. `/services/data/v54.0/sobjects/Attachment/00P6g000007BzmTEAS/Body`)
 * @returns
 */
export async function streamFileDownload(orgId: string, data: { url: string }) {
  const connection = getJsforceConnection(orgId);
  const { url } = data;
  const rv = new PassThrough();
  // ensure that our token is valid and not expired
  await connection.identity();

  const results = await fetch(`${connection.instanceUrl}${url}`, {
    method: 'GET',
    headers: { ['Authorization']: `Bearer ${connection.accessToken}`, ['X-SFDC-Session']: connection.accessToken },
  }).then(async (res) => {
    res.body.pipe(rv);
  });
  return rv;
}
