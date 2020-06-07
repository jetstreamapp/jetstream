/* eslint-disable @typescript-eslint/no-explicit-any */
import * as request from 'superagent'; // http://visionmedia.github.io/superagent
import * as API from '@jetstream/api-interfaces';
import { SalesforceOrg } from '@jetstream/types';

export async function handleRequest<T = any>(currRequest: request.SuperAgentRequest, org?: SalesforceOrg) {
  try {
    if (org) {
      currRequest.set({
        'X-SFDC-ID': org.uniqueId || '',
        'X-SFDC-LOGIN-URL': org.loginUrl || '',
        'X-SFDC-INSTANCE-URL': org.instanceUrl || '',
        'X-SFDC-ACCESS-TOKEN': org.accessToken || '',
        'X-SFDC-API-VER': org.apiVersion || '',
        'X-SFDC-NAMESPACE-PREFIX': org.orgNamespacePrefix || '',
      });
    }
    console.log(`[HTTP][REQUEST][${currRequest.method}]`, currRequest.url, { request: currRequest });
    const response = await currRequest;
    console.log(`[HTTP][RESPONSE][${currRequest.method}][${response.status}]`, currRequest.url, { response: response.body });
    const body: API.RequestResult<T> = response.body;
    return body.data;
  } catch (ex) {
    console.log('[HTTP][RESPONSE][ERROR]', { exception: ex });
    const response: { error: boolean; message: string } = ex.response?.body;
    const message = response?.message || 'An unknown error has occurred';
    throw new Error(message);
  }
}

// export function initConnection(
//   authInfo: SalesforceConnectionAuth | SalesforceConnection | Partial<SalesforceConnection>,
//   version = DEFAULT_SFDC_API_VER.version,
//   namespacePrefix?: string
// ) {
//   if (!version) {
//     version = DEFAULT_SFDC_API_VER.version;
//   }
//   const connData: ConnectionOptions = {
//     oauth2: getOAth2(null, authInfo.loginUrl),
//     instanceUrl: authInfo.instanceUrl,
//     accessToken: authInfo.accessToken,
//     refreshToken: authInfo.refreshToken,
//     maxRequest: 5,
//     version,
//   };
//   if (namespacePrefix) {
//     connData.callOptions = { ...connData.callOptions, defaultNamespace: namespacePrefix };
//   }
//   return new jsforce.Connection(connData);
// }
