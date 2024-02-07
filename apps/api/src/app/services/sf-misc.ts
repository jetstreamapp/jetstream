import { ENV } from '@jetstream/api-config';
import { HTTP, ORG_VERSION_PLACEHOLDER } from '@jetstream/shared/constants';
import { ensureArray, getFullNameFromListMetadata, orderObjectsBy } from '@jetstream/shared/utils';
import { ListMetadataResult, ManualRequestPayload, ManualRequestResponse, MapOf } from '@jetstream/types';
import axios, { AxiosError, AxiosRequestConfig } from 'axios';
import type { PackageTypeMembers, RetrieveRequest } from 'jsforce';
import * as jsforce from 'jsforce';
import { isObjectLike, isString, get as lodashGet } from 'lodash';
import { create as xmlBuilder } from 'xmlbuilder2';
import { UserFacingError } from '../utils/error-handler';

const SESSION_ID_RGX = /\{sessionId\}/i;
const VALID_PACKAGE_VERSION = /^[0-9]+\.[0-9]+$/;

export interface SalesforceRequestViaAxiosOptions extends ManualRequestPayload {
  conn: jsforce.Connection;
  /**
   * If true, the function will throw an error if the request fails
   * @default false
   */
  throwIfError?: boolean;
  /**
   * If true, the function will attempt to refresh the token and retry the request
   * @default true
   */
  retryOnAuthFailure?: boolean;
}

/**
 * Make API call to Salesforce without using JSForce
 */
export async function salesforceRequestViaAxios(options: SalesforceRequestViaAxiosOptions): Promise<ManualRequestResponse> {
  const { conn, method, headers = {}, throwIfError = false, retryOnAuthFailure = true } = options;
  let { body, url } = options;
  try {
    url = url.replace(ORG_VERSION_PLACEHOLDER, conn.version);

    const config: AxiosRequestConfig = {
      url,
      method,
      baseURL: conn.instanceUrl,
      // X-SFDC-Session is used for some SOAP APIs, such as the bulk api
      headers: {
        [HTTP.HEADERS.CONTENT_TYPE]: HTTP.CONTENT_TYPE.JSON,
        [HTTP.HEADERS.ACCEPT]: HTTP.CONTENT_TYPE.JSON,
        ...headers,
        ['Authorization']: `Bearer ${conn.accessToken}`,
        ['X-SFDC-Session']: conn.accessToken,
      },
      responseType: 'text',
      // validateStatus: false,
      timeout: 120000,
      transformResponse: [], // required to avoid automatic json parsing
    };

    if (isString(body) && SESSION_ID_RGX.test(body)) {
      body = body.replace(SESSION_ID_RGX, conn.accessToken);
    }

    if (method !== 'GET' && body) {
      config.data = body;
    }

    const response = await axios.request(config);

    return {
      error: false,
      status: response.status,
      statusText: response.statusText,
      headers: JSON.stringify(response.headers || {}, null, 2),
      body: response.data,
    };
  } catch (ex) {
    if (retryOnAuthFailure && ex instanceof AxiosError) {
      const response = ex.response;
      if (response.status === 401 || (isString(response.data) && response.data.includes('INVALID_SESSION_ID'))) {
        // attempt another API call which should auto-refresh and try again
        try {
          await refreshAccessToken(conn);
        } catch (ex) {
          console.error('Failed to refresh token', ex);
        }
        return await salesforceRequestViaAxios({ ...options, retryOnAuthFailure: false });
      }
    }
    if (throwIfError) {
      throw ex;
    }
    if (ex instanceof AxiosError) {
      const response = ex.response;
      if (response) {
        return {
          error: response.status < 200 || response.status > 300,
          status: response.status,
          statusText: response.statusText,
          headers: JSON.stringify(response.headers || {}, null, 2),
          body: response.data,
        };
      } else if (ex.request) {
        return {
          error: true,
          errorMessage: ex.message || 'An unknown error has occurred.',
          status: null,
          statusText: null,
          headers: null,
          body: null,
        };
      }
    } else if (ex instanceof Error) {
      return {
        error: true,
        errorMessage: ex.message || 'An unknown error has occurred.',
        status: null,
        statusText: null,
        headers: null,
        body: null,
      };
    }
    return {
      error: true,
      errorMessage: ex?.message || 'An unknown error has occurred, the request was not made.',
      status: null,
      statusText: null,
      headers: null,
      body: null,
    };
  }
}

export async function refreshAccessToken(conn: jsforce.Connection): Promise<void> {
  try {
    const response = await axios.request<{ access_token: string }>({
      url: '/services/oauth2/token',
      method: 'POST',
      baseURL: conn.instanceUrl,
      // X-SFDC-Session is used for some SOAP APIs, such as the bulk api
      headers: {
        [HTTP.HEADERS.CONTENT_TYPE]: HTTP.CONTENT_TYPE.FORM_URL,
        [HTTP.HEADERS.ACCEPT]: HTTP.CONTENT_TYPE.JSON,
      },
      responseType: 'json',
      timeout: 20000,
      data: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: ENV.SFDC_CONSUMER_KEY,
        client_secret: ENV.SFDC_CONSUMER_SECRET,
        refresh_token: conn.refreshToken,
      }).toString(),
    });

    conn.accessToken = response.data.access_token;
    try {
      conn.emit('refresh', conn.accessToken, conn.refreshToken);
    } catch (ex) {
      console.error('Failed to emit refresh event', ex);
    }
  } catch (ex) {
    console.error('Failed to refresh token', ex);
    throw ex;
  }
}

export function buildPackageXml(types: MapOf<ListMetadataResult[]>, version: string, otherFields: MapOf<string> = {}, prettyPrint = true) {
  // prettier-ignore
  const packageNode = xmlBuilder({ version: '1.0', encoding: 'UTF-8' })
    .ele('Package', { xmlns: 'http://soap.sforce.com/2006/04/metadata' });

  Object.keys(types).forEach((metadataType) => {
    const typesNode = packageNode.ele('types');
    if (types[metadataType].length) {
      orderObjectsBy(types[metadataType], 'fullName').forEach(({ fullName, namespacePrefix }) => {
        typesNode.ele('members').txt(
          getFullNameFromListMetadata({
            fullName,
            metadataType,
            namespace: namespacePrefix,
          })
        );
      });
      typesNode.ele('name').txt(metadataType);
    }
  });

  if (otherFields) {
    Object.keys(otherFields).forEach((key) => {
      packageNode.ele(key).txt(otherFields[key]);
    });
  }

  packageNode.ele('version').txt(version);

  return packageNode.end({ prettyPrint });
}

export function getRetrieveRequestFromListMetadata(types: MapOf<ListMetadataResult[]>, version: string) {
  // https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_retrieve_request.htm
  const retrieveRequest: RetrieveRequest = {
    apiVersion: version,
    singlePackage: true,
    unpackaged: {
      types: Object.keys(types).map((metadataName) => {
        const members = types[metadataName];
        return {
          members: members.map(({ fullName, namespacePrefix }) => {
            return getFullNameFromListMetadata({
              fullName,
              metadataType: metadataName,
              namespace: namespacePrefix,
            });
          }),
          name: metadataName,
        };
      }),
      version: version,
    },
  };
  return retrieveRequest;
}

/**
 * TODO: should we handle other packages fields?
 *
 * @param packageManifest
 */
export function getRetrieveRequestFromManifest(packageManifest: string) {
  let manifestXml;
  try {
    manifestXml = xmlBuilder(packageManifest).toObject({ wellFormed: true }) as any;
  } catch (ex) {
    throw new UserFacingError('The package manifest format is invalid');
  }
  // validate parsed package manifest
  if (!manifestXml || Array.isArray(manifestXml)) {
    throw new UserFacingError('The package manifest format is invalid');
  } else {
    const version: string = lodashGet(manifestXml, 'Package.version');
    let types: PackageTypeMembers[] = lodashGet(manifestXml, 'Package.types');
    if (isObjectLike(types)) {
      types = ensureArray(types);
    }
    if (!isString(version) || !VALID_PACKAGE_VERSION.test(version)) {
      throw new UserFacingError('The package manifest version is invalid or is missing');
    } else if (!Array.isArray(types) || !types.length) {
      throw new UserFacingError('The package manifest is missing types');
    }

    const retrieveRequest: RetrieveRequest = {
      apiVersion: version,
      unpackaged: {
        types,
        version: version,
      },
    };
    return retrieveRequest;
  }
}
