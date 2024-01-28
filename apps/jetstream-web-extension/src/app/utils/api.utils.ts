import { QueryResults, QueryResultsColumns } from '@jetstream/api-interfaces';
import { flattenQueryColumn } from '@jetstream/shared/utils';
import { ApiResponse, CompositeResponse, GenericRequestPayload, Maybe, SObjectOrganization, SalesforceOrgUi } from '@jetstream/types';
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
  readonly baseUrlWithoutPath: string;
  readonly baseUrl: string;
  readonly sessionInfo: SessionInfo;
  readonly org: SalesforceOrgUi;

  constructor(sessionInfo: SessionInfo, apiVersion: string, org: SalesforceOrgUi) {
    this.apiVersion = apiVersion;
    this.org = org;
    this.sessionInfo = sessionInfo;
    this.baseUrlWithoutPath = `https://${sessionInfo.hostname}`;
    this.baseUrl = `${this.baseUrlWithoutPath}/services/data/v${apiVersion}`;
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
    allOrNone = true,
    isTooling = false,
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
    let operationPromise: Promise<unknown> | undefined;

    const request = {
      allOrNone,
      records: [
        {
          attributes: { type: 'Account' },
          Name: 'example.com',
          BillingCity: 'San Francisco',
        },
        {
          attributes: { type: 'Contact' },
          LastName: 'Johnson',
          FirstName: 'Erica',
        },
      ],
    };

    if (ids) {
      ids = Array.isArray(ids) ? ids : [ids];
    }
    if (records) {
      records = Array.isArray(records) ? records : [records];
    }

    // POST https://MyDomainName.my.salesforce.com/services/data/v60.0/composite/sobjects/

    switch (operation) {
      case 'retrieve': {
        if (!Array.isArray(ids)) {
          throw new Error(`The ids property must be included`);
        }

        operationPromise = apiRequest<CompositeResponse>({
          method: 'POST',
          sessionInfo: this.sessionInfo,
          url: `${this.baseUrl}/composite`,
          body: {
            allOrNone,
            compositeRequest: ids
              .map((id) =>
                isTooling
                  ? `/services/data/v${this.apiVersion}/tooling/sobjects/${sobject}/${id}`
                  : `/services/data/v${this.apiVersion}/sobjects/${sobject}/${id}`
              )
              .map((url, i) => ({ method: 'GET', url: url, referenceId: `${i}` })),
          },
        }).then((response) => response.compositeResponse.map((item) => item.body));

        break;
      }
      case 'create': {
        if (!Array.isArray(records)) {
          throw new Error(`The records property must be included`);
        }

        operationPromise = apiRequest({
          method: 'POST',
          sessionInfo: this.sessionInfo,
          url: isTooling ? `${this.baseUrl}/tooling/composite/sobjects` : `${this.baseUrl}/composite/sobjects`,
          body: {
            allOrNone,
            records: records.map((record) => ({ ...record, attributes: { type: sobject }, Id: undefined })),
          },
        });
        break;
      }
      case 'update': {
        if (!Array.isArray(records)) {
          throw new Error(`The records property must be included`);
        }

        operationPromise = apiRequest({
          method: 'PATCH',
          sessionInfo: this.sessionInfo,
          url: isTooling ? `${this.baseUrl}/tooling/composite/sobjects` : `${this.baseUrl}/composite/sobjects`,
          body: {
            allOrNone,
            records: records.map((record) => ({ ...record, attributes: { type: sobject }, Id: record.Id })),
          },
        });

        break;
      }
      case 'upsert': {
        if (!Array.isArray(records) || !externalId) {
          throw new Error(`The records and external id properties must be included`);
        }
        operationPromise = apiRequest({
          method: 'PATCH',
          sessionInfo: this.sessionInfo,
          url: isTooling
            ? `${this.baseUrl}/tooling/composite/sobjects/${sobject}/${externalId}`
            : `${this.baseUrl}/composite/sobjects/${sobject}/${externalId}`,
          body: {
            allOrNone,
            records: records.map((record) => ({ ...record, attributes: { type: sobject } })),
          },
        });
        break;
      }
      case 'delete': {
        if (!Array.isArray(ids)) {
          throw new Error(`The ids property must be included`);
        }

        operationPromise = apiRequest({
          method: 'DELETE',
          sessionInfo: this.sessionInfo,
          url: isTooling
            ? `${this.baseUrl}/tooling/composite/sobjects?ids=${ids.join(',')}`
            : `${this.baseUrl}/composite/sobjects?ids=${ids.join(',')}`,
        });

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
