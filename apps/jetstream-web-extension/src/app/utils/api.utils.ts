import { QueryResults, QueryResultsColumns } from '@jetstream/api-interfaces';
import { flattenQueryColumn } from '@jetstream/shared/utils';
import { ApiResponse, GenericRequestPayload, Maybe, SObjectOrganization, SalesforceOrgUi } from '@jetstream/types';
import type { DescribeGlobalResult, DescribeSObjectResult, IdentityInfo, QueryResult } from 'jsforce';
import { Query, parseQuery } from 'soql-parser-js';
import { SessionInfo } from '../extension.types';

export interface QueryColumnsSfdc {
  columnMetadata: QueryColumnMetadata[];
  entityName: string;
  groupBy: boolean;
  idSelected: boolean;
  keyPrefix: string;
}

export interface QueryColumnMetadata {
  aggregate: boolean;
  apexType: string;
  booleanType: boolean;
  columnName: string;
  custom: boolean;
  displayName: string;
  foreignKeyName?: any;
  insertable: boolean;
  joinColumns: QueryColumnMetadata[];
  numberType: boolean;
  textType: boolean;
  updatable: boolean;
}

export class ApiClient {
  readonly apiVersion;
  readonly baseUrl: string;
  readonly sessionInfo: SessionInfo;
  readonly org: SalesforceOrgUi;

  constructor(sessionInfo: SessionInfo, apiVersion: string, org: SalesforceOrgUi) {
    this.apiVersion = apiVersion;
    this.org = org;
    this.sessionInfo = sessionInfo;
    this.baseUrl = `https://${sessionInfo.hostname}/services/data/v${apiVersion}`;
  }

  // TODO: we should move logic to a different file

  async query<T = any>(soql: string, isTooling = false, includeDeletedRecords = false): Promise<ApiResponse<QueryResults<T>>> {
    const queryVerb = includeDeletedRecords ? 'queryAll' : 'query';
    const url = isTooling
      ? `${this.baseUrl}/tooling/${queryVerb}?${new URLSearchParams({ q: soql }).toString()}`
      : `${this.baseUrl}/${queryVerb}?${new URLSearchParams({ q: soql }).toString()}`;
    const queryResults = await apiRequest<QueryResult<T>>({
      sessionInfo: this.sessionInfo,
      url,
    });

    let columns: QueryResultsColumns | undefined;
    let parsedQuery: Query | undefined;

    try {
      const tempColumns = await apiRequest<QueryColumnsSfdc>({
        method: 'GET',
        sessionInfo: this.sessionInfo,
        url: `${this.baseUrl}${isTooling ? '/tooling' : ''}/query/?${new URLSearchParams({
          q: soql,
          columns: 'true',
        }).toString()}`,
      });

      columns = {
        entityName: tempColumns.entityName,
        groupBy: tempColumns.groupBy,
        idSelected: tempColumns.idSelected,
        keyPrefix: tempColumns.keyPrefix,
        columns: tempColumns.columnMetadata?.flatMap((column) => flattenQueryColumn(column)),
      };
    } catch (ex) {
      console.warn('Error fetching columns', ex);
    }

    // Attempt to parse columns from query
    try {
      parsedQuery = parseQuery(soql);
    } catch (ex) {
      console.info('Error parsing query');
    }

    return { data: { queryResults, columns, parsedQuery } };
  }

  async queryMore<T = any>(queryLocator: string, isTooling = false): Promise<ApiResponse<QueryResult<T>>> {
    const url = isTooling ? `${this.baseUrl}/tooling/query/${queryLocator}` : `${this.baseUrl}/query/${queryLocator}`;
    const data = await apiRequest<QueryResult<T>>({
      sessionInfo: this.sessionInfo,
      url,
    });
    return { data };
  }

  async describe(isTooling = false): Promise<ApiResponse<DescribeGlobalResult>> {
    const url = isTooling ? `${this.baseUrl}/tooling/sobjects` : `${this.baseUrl}/sobjects`;
    const data = await apiRequest<DescribeGlobalResult>({ sessionInfo: this.sessionInfo, url });
    return { data };
  }

  async describeSobject(sobject: string, isTooling = false): Promise<ApiResponse<DescribeSObjectResult>> {
    const url = isTooling ? `${this.baseUrl}/tooling/sobjects/${sobject}/describe` : `${this.baseUrl}/sobjects/${sobject}/describe`;
    const data = await apiRequest<DescribeSObjectResult>({ sessionInfo: this.sessionInfo, url });
    return { data };
  }

  async recordOperation({
    sobject,
    operation,
    externalId,
    allOrNone,
    isTooling,
    ids,
    records,
  }: {
    sobject: string;
    operation: string;
    externalId?: Maybe<string>;
    allOrNone?: Maybe<boolean>;
    ids?: Maybe<string | string[]>;
    isTooling?: Maybe<boolean>;
    records: Maybe<any | any[]>;
  }) {
    // TODO: options
    const options: any = { allOrNone };

    let operationPromise: Promise<unknown> | undefined;
    switch (operation) {
      case 'retrieve': {
        if (!ids) {
          throw new Error(`The ids property must be included`);
        }
        if (Array.isArray(ids)) {
          // TODO:
        }
        const url = isTooling ? `${this.baseUrl}/tooling/sobjects/${sobject}/${ids}` : `${this.baseUrl}/sobjects/${sobject}/${ids}`;
        operationPromise = apiRequest({ method: 'GET', sessionInfo: this.sessionInfo, url });

        break;
      }
      case 'create': {
        if (!records) {
          throw new Error(`The records property must be included`);
        }
        if (Array.isArray(records)) {
          // TODO:
        }
        const url = isTooling ? `${this.baseUrl}/tooling/sobjects/${sobject}` : `${this.baseUrl}/sobjects/${sobject}`;
        operationPromise = apiRequest({ method: 'POST', sessionInfo: this.sessionInfo, url, body: records });
        break;
      }
      case 'update': {
        if (!records) {
          throw new Error(`The records property must be included`);
        }
        if (Array.isArray(records) && records.length > 1) {
          // TODO:
        } else {
          const record = Array.isArray(records) ? records[0] : records;
          const recordId = record.Id;
          delete record.Id;
          const url = isTooling
            ? `${this.baseUrl}/tooling/sobjects/${sobject}/${recordId}`
            : `${this.baseUrl}/sobjects/${sobject}/${recordId}`;
          operationPromise = apiRequest({ method: 'PATCH', sessionInfo: this.sessionInfo, url, body: record });
        }
        break;
      }
      case 'upsert': {
        if (!records || !externalId) {
          throw new Error(`The records and external id properties must be included`);
        }
        if (Array.isArray(records)) {
          // TODO:
        }
        // TODO: get external if from record and make request
        const url = isTooling ? `${this.baseUrl}/tooling/sobjects/${sobject}/${externalId}` : `${this.baseUrl}/sobjects/${sobject}`;
        operationPromise = apiRequest({ method: 'PATCH', sessionInfo: this.sessionInfo, url, body: records });
        break;
      }
      case 'delete': {
        if (!ids) {
          throw new Error(`The ids property must be included`);
        }
        if (Array.isArray(ids)) {
          // TODO:
        }
        const url = isTooling ? `${this.baseUrl}/tooling/sobjects/${sobject}${ids}` : `${this.baseUrl}/sobjects/${sobject}${ids}`;
        operationPromise = apiRequest({ method: 'DELETE', sessionInfo: this.sessionInfo, url });

        break;
      }
      default:
        throw new Error(`The operation ${operation} is not valid`);
    }

    if (!operationPromise) {
      throw new Error('operationPromise is undefined');
    }

    const data = await operationPromise;
    return { data };
  }

  async manualRequest({ isTooling, method, url, body, headers = {}, options }: GenericRequestPayload) {
    if (options?.responseType) {
      headers = headers || {};
      headers['Content-Type'] = options.responseType;
      headers['Accept'] = '*';
    }
    const data = await apiRequest({
      sessionInfo: this.sessionInfo,
      url: `https://${this.sessionInfo.hostname}${url}`,
      method: method,
      body: body,
      headers: headers,
    });

    // TODO: server sends this for request-manual
    // {
    //   error: response.status < 200 || response.status > 300,
    //   status: response.status,
    //   statusText: response.statusText,
    //   headers: JSON.stringify(response.headers || {}, null, 2),
    //   body: response.data,
    // }

    return { data };
  }
}

async function apiRequest<T = unknown>({
  method = 'GET',
  sessionInfo,
  url,
  body,
  headers,
}: {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  url: string;
  body?: any;
  headers?: Record<string, string>;
  sessionInfo: SessionInfo;
}): Promise<T> {
  console.log('[REQUEST][%s][%s]', method, url, body);
  return fetch(url, {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: {
      Authorization: `Bearer ${sessionInfo.key}`,
      'Content-Type': 'application/json; charset=UTF-8',
      Accept: 'application/json; charset=UTF-8',
      'X-SFDC-Session': sessionInfo.key,
      ...headers,
    },
  })
    .then(async (response) => {
      if (response.ok) {
        return response.json();
      }
      throw new Error(await response.text());
    })
    .then((response) => {
      console.log('[RESPONSE][%s][%s]', method, url, response);
      return response as T;
    });
}

export async function initApiClient(sessionInfo: SessionInfo): Promise<ApiClient> {
  const instanceUrl = `https://${sessionInfo.hostname}`;
  const versions = await apiRequest<{ label: string; url: string; version: string }[]>({
    sessionInfo: sessionInfo,
    url: `${instanceUrl}/services/data`,
  });
  const apiVersion = versions.reverse()[0].version;
  const identityUrl = (
    await apiRequest<{ identity: string }>({ sessionInfo: sessionInfo, url: `${instanceUrl}/services/data/v${apiVersion}` })
  ).identity;
  const identity = await apiRequest<IdentityInfo>({ sessionInfo, url: identityUrl });
  let companyInfoRecord: SObjectOrganization | undefined;

  try {
    const results = await apiRequest<QueryResult<SObjectOrganization>>({
      sessionInfo: sessionInfo,
      url: `${instanceUrl}/services/data/v${apiVersion}/query?q=${encodeURIComponent(
        `SELECT Id, Name, Country, OrganizationType, InstanceName, IsSandbox, LanguageLocaleKey, NamespacePrefix, TrialExpirationDate FROM Organization`
      )}`,
    });
    if (results.totalSize > 0) {
      companyInfoRecord = results.records[0];
    }
  } catch (ex) {
    console.warn('Error getting org info %o', ex);
  }

  const org: SalesforceOrgUi = {
    uniqueId: identity.organization_id,
    label: identity.username,
    filterText: identity.username,
    accessToken: '',
    instanceUrl,
    loginUrl: instanceUrl,
    userId: identity.user_id,
    email: identity.email,
    organizationId: identity.organization_id,
    username: identity.username,
    displayName: identity.display_name,
    thumbnail: identity.photos?.thumbnail,
    orgName: companyInfoRecord?.Name || 'Unknown Organization',
    orgCountry: companyInfoRecord?.Country,
    orgOrganizationType: companyInfoRecord?.OrganizationType,
    orgInstanceName: companyInfoRecord?.InstanceName,
    orgIsSandbox: companyInfoRecord?.IsSandbox,
    orgLanguageLocaleKey: companyInfoRecord?.LanguageLocaleKey,
    orgNamespacePrefix: companyInfoRecord?.NamespacePrefix,
    orgTrialExpirationDate: companyInfoRecord?.TrialExpirationDate,
  };

  return new ApiClient(sessionInfo, apiVersion, org);
}
