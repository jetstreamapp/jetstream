/* eslint-disable @typescript-eslint/no-explicit-any */
import * as API from '@jetstream/api-interfaces';
import { HTTP } from '@jetstream/shared/constants';
import {
  ApiResponse,
  BulkApiCreateJobRequestPayload,
  BulkApiDownloadType,
  BulkJob,
  BulkJobBatchInfo,
  BulkJobWithBatches,
  DeployResult,
  GenericRequestPayload,
  ListMetadataResult,
  ListMetadataResultRaw,
  MapOf,
  RetrieveResult,
  SalesforceOrgUi,
  SobjectOperation,
  UserProfileUi,
} from '@jetstream/types';
import {
  AsyncResult,
  DeployOptions,
  DescribeGlobalResult,
  DescribeMetadataResult,
  DescribeSObjectResult,
  ListMetadataQuery,
} from 'jsforce';
import { handleRequest, transformListMetadataResponse } from './client-data-data-helper';
//// LANDING PAGE ROUTES

function unwrapResponseIgnoreCache<T>(response: ApiResponse<T>) {
  return response.data;
}

export async function signUpNotify(email: string): Promise<DescribeGlobalResult> {
  return handleRequest({
    method: 'POST',
    url: '/landing/sign-up/notify',
    data: { email },
  }).then(unwrapResponseIgnoreCache);
}

//// APPLICATION ROUTES
export async function getUserProfile(): Promise<UserProfileUi> {
  return handleRequest({ method: 'GET', url: '/api/me' }).then(unwrapResponseIgnoreCache);
}

export async function getOrgs(): Promise<SalesforceOrgUi[]> {
  return handleRequest({ method: 'GET', url: '/api/orgs' }).then(unwrapResponseIgnoreCache);
}

export async function updateOrg(org: SalesforceOrgUi, partialOrg: Partial<SalesforceOrgUi>): Promise<void> {
  return handleRequest({ method: 'PATCH', url: `/api/orgs/${org.uniqueId}`, data: partialOrg }).then(unwrapResponseIgnoreCache);
}

export async function deleteOrg(org: SalesforceOrgUi): Promise<void> {
  return handleRequest({ method: 'DELETE', url: `/api/orgs/${org.uniqueId}` }).then(unwrapResponseIgnoreCache);
}

export async function describeGlobal(org: SalesforceOrgUi, isTooling = false): Promise<ApiResponse<DescribeGlobalResult>> {
  return handleRequest(
    { method: 'GET', url: '/api/describe', params: { isTooling } },
    { org, useCache: true, useQueryParamsInCacheKey: true }
  ).then((response: ApiResponse<DescribeGlobalResult>) => {
    if (response.data && Array.isArray(response.data.sobjects)) {
      response.data.sobjects.forEach((sobject) => {
        if (sobject.label.startsWith('__MISSING LABEL__')) {
          sobject.label = sobject.name;
        }
      });
    }
    return response;
  });
}

export async function describeSObject(
  org: SalesforceOrgUi,
  SObject: string,
  isTooling = false
): Promise<ApiResponse<DescribeSObjectResult>> {
  return handleRequest(
    { method: 'GET', url: `/api/describe/${SObject}`, params: { isTooling } },
    { org, useCache: true, useQueryParamsInCacheKey: true, mockHeaderKey: SObject.startsWith('@') ? SObject : undefined }
  );
}

export async function query<T = any>(
  org: SalesforceOrgUi,
  query: string,
  isTooling = false,
  includeDeletedRecords = false
): Promise<API.QueryResults<T>> {
  return handleRequest(
    { method: 'POST', url: `/api/query`, params: { isTooling, includeDeletedRecords }, data: { query } },
    { org, useQueryParamsInCacheKey: true, useBodyInCacheKey: true }
  ).then(unwrapResponseIgnoreCache);
}

export async function queryWithCache<T = any>(
  org: SalesforceOrgUi,
  query: string,
  isTooling = false
): Promise<ApiResponse<API.QueryResults<T>>> {
  return handleRequest(
    { method: 'POST', url: `/api/query`, params: { isTooling }, data: { query } },
    { org, useCache: true, useQueryParamsInCacheKey: true, useBodyInCacheKey: true }
  );
}

export async function queryMore<T = any>(org: SalesforceOrgUi, nextRecordsUrl: string, isTooling = false): Promise<API.QueryResults<T>> {
  return handleRequest({ method: 'GET', url: `/api/query-more`, params: { nextRecordsUrl, isTooling } }, { org }).then(
    unwrapResponseIgnoreCache
  );
}

/**
 * Query all records using a query locator to fetch all records
 *
 * @param org
 * @param soqlQuery
 * @param isTooling
 * @param includeDeletedRecords
 */
export async function queryAll<T = any>(
  org: SalesforceOrgUi,
  soqlQuery: string,
  isTooling = false,
  includeDeletedRecords = false
): Promise<API.QueryResults<T>> {
  const results = await query(org, soqlQuery, isTooling, includeDeletedRecords);
  while (!results.queryResults.done) {
    const currentResults = await queryMore(org, results.queryResults.nextRecordsUrl, isTooling);
    // update initial object with current results
    results.queryResults.records = results.queryResults.records.concat(currentResults.queryResults.records);
    results.queryResults.nextRecordsUrl = currentResults.queryResults.nextRecordsUrl;
    results.queryResults.done = currentResults.queryResults.done;
  }
  results.queryResults.done = true;
  return results;
}

/**
 * This could result in an error: Maximum SOQL offset allowed is 2000
 *
 * @param selectedOrg
 * @param queries
 */
export async function queryAllUsingOffset<T = any>(
  selectedOrg: SalesforceOrgUi,
  soqlQuery: string,
  isTooling = false
): Promise<API.QueryResults<T>> {
  const LIMIT = 2000;
  let offset = 0;
  let done = false;

  const results = await query<T>(selectedOrg, `${soqlQuery} LIMIT ${LIMIT} OFFSET ${offset}`, isTooling);

  // Metadata objects may not allow queryMore, we use this to fetch more
  while (done) {
    const { queryResults } = await query<T>(selectedOrg, `${soqlQuery} LIMIT ${LIMIT} OFFSET ${offset}`);
    results.queryResults.records = results.queryResults.records.concat(queryResults.records);
    done = queryResults.done;

    if (queryResults.records.length === LIMIT) {
      done = false;
      offset += LIMIT;
    } else {
      done = true;
    }
  }
  return results;
}

export async function sobjectOperation<T = any>(
  org: SalesforceOrgUi,
  sobject: string,
  operation: SobjectOperation,
  body: {
    ids?: string | string[]; // required for retrieve | create | delete
    records?: any | any[]; // required for create | update | upsert
  },
  query: {
    externalId?: string;
    allOrNone?: boolean;
  } = {}
): Promise<T> {
  return handleRequest({ method: 'POST', url: `/api/record/${operation}/${sobject}`, params: { ...query }, data: body }, { org }).then(
    unwrapResponseIgnoreCache
  );
}

export async function describeMetadata(org: SalesforceOrgUi): Promise<ApiResponse<DescribeMetadataResult>> {
  return handleRequest({ method: 'GET', url: `/api/metadata/describe` }, { org, useCache: true });
}

export async function listMetadata(
  org: SalesforceOrgUi,
  types: ListMetadataQuery[],
  skipRequestCache = false
): Promise<ApiResponse<ListMetadataResult[]>> {
  return handleRequest<ListMetadataResultRaw[]>(
    { method: 'POST', url: `/api/metadata/list`, data: { types } },
    { org, useCache: true, skipRequestCache, useBodyInCacheKey: true }
  ).then(({ data, cache }) => ({
    data: transformListMetadataResponse(data),
    cache,
  }));
}

export async function readMetadata<T = any>(org: SalesforceOrgUi, type: string, fullNames: string[]): Promise<T[]> {
  return handleRequest({ method: 'POST', url: `/api/metadata/read/${type}`, data: { fullNames } }, { org }).then(unwrapResponseIgnoreCache);
}

export async function deployMetadata(
  org: SalesforceOrgUi,
  files: { fullFilename: string; content: string }[],
  options?: DeployOptions
): Promise<AsyncResult> {
  return handleRequest({ method: 'POST', url: `/api/metadata/deploy`, data: { files, options } }, { org }).then(unwrapResponseIgnoreCache);
}

export async function deployMetadataZip(org: SalesforceOrgUi, zipFile: any, options: DeployOptions): Promise<AsyncResult> {
  return handleRequest(
    {
      method: 'POST',
      url: `/api/metadata/deploy-zip`,
      data: zipFile,
      params: { options: JSON.stringify(options) },
      headers: { [HTTP.HEADERS.CONTENT_TYPE]: HTTP.CONTENT_TYPE.ZIP },
    },
    { org }
  ).then(unwrapResponseIgnoreCache);
}

export async function checkMetadataResults(org: SalesforceOrgUi, id: string, includeDetails = false): Promise<DeployResult> {
  return handleRequest({ method: 'GET', url: `/api/metadata/deploy/${id}`, params: { includeDetails } }, { org }).then(
    unwrapResponseIgnoreCache
  );
}

export async function retrieveMetadataFromListMetadata(
  org: SalesforceOrgUi,
  payload: MapOf<ListMetadataResult[]>
): Promise<RetrieveResult> {
  return handleRequest({ method: 'POST', url: `/api/metadata/retrieve/list-metadata`, data: payload }, { org }).then(
    unwrapResponseIgnoreCache
  );
}

export async function retrieveMetadataFromPackagesNames(org: SalesforceOrgUi, packageNames: string[]): Promise<RetrieveResult> {
  return handleRequest({ method: 'POST', url: `/api/metadata/retrieve/package-names`, data: { packageNames } }, { org }).then(
    unwrapResponseIgnoreCache
  );
}

export async function retrieveMetadataFromManifestFile(org: SalesforceOrgUi, packageManifest: string): Promise<RetrieveResult> {
  return handleRequest({ method: 'POST', url: `/api/metadata/retrieve/manifest`, data: { packageManifest } }, { org }).then(
    unwrapResponseIgnoreCache
  );
}

export async function checkMetadataRetrieveResults(org: SalesforceOrgUi, id: string): Promise<RetrieveResult> {
  return handleRequest({ method: 'GET', url: `/api/metadata/retrieve/check-results`, params: { id } }, { org }).then(
    unwrapResponseIgnoreCache
  );
}

export async function checkMetadataRetrieveResultsAndDeployToTarget(
  org: SalesforceOrgUi,
  targetOrg: SalesforceOrgUi,
  {
    id,
    deployOptions,
    replacementPackageXml,
    changesetName,
  }: { id: string; deployOptions: DeployOptions; replacementPackageXml?: string; changesetName?: string }
): Promise<{ type: 'deploy' | 'retrieve'; results: RetrieveResult }> {
  return handleRequest(
    {
      method: 'POST',
      url: `/api/metadata/retrieve/check-and-redeploy`,
      params: { id },
      data: { deployOptions, replacementPackageXml, changesetName },
    },
    { org, targetOrg }
  ).then(unwrapResponseIgnoreCache);
}

export async function getPackageXml(
  org: SalesforceOrgUi,
  metadata: MapOf<ListMetadataResult[]>,
  otherFields: MapOf<string> = {}
): Promise<string> {
  return handleRequest({ method: 'POST', url: `/api/metadata/package-xml`, data: { metadata, otherFields } }, { org }).then(
    unwrapResponseIgnoreCache
  );
}

export async function genericRequest<T = any>(org: SalesforceOrgUi, payload: GenericRequestPayload): Promise<T> {
  return handleRequest({ method: 'POST', url: `/api/request`, data: payload }, { org }).then(unwrapResponseIgnoreCache);
}

export async function bulkApiCreateJob(org: SalesforceOrgUi, payload: BulkApiCreateJobRequestPayload): Promise<BulkJobWithBatches> {
  return handleRequest({ method: 'POST', url: `/api/bulk`, data: payload }, { org }).then(unwrapResponseIgnoreCache);
}

export async function bulkApiGetJob(org: SalesforceOrgUi, jobId: string): Promise<BulkJobWithBatches> {
  return handleRequest({ method: 'GET', url: `/api/bulk/${jobId}` }, { org }).then(unwrapResponseIgnoreCache);
}

export async function bulkApiCloseJob(org: SalesforceOrgUi, jobId: string): Promise<BulkJob> {
  return handleRequest({ method: 'DELETE', url: `/api/bulk/${jobId}` }, { org }).then(unwrapResponseIgnoreCache);
}

export async function bulkApiAddBatchToJob(
  org: SalesforceOrgUi,
  jobId: string,
  csv: string,
  closeJob?: boolean
): Promise<BulkJobBatchInfo> {
  return handleRequest(
    { method: 'POST', url: `/api/bulk/${jobId}`, data: csv, headers: { [HTTP.HEADERS.CONTENT_TYPE]: HTTP.CONTENT_TYPE.CSV } },
    { org }
  ).then(unwrapResponseIgnoreCache);
}

export async function bulkApiGetRecords<T = any>(
  org: SalesforceOrgUi,
  jobId: string,
  batchId: string,
  type: BulkApiDownloadType
): Promise<T[]> {
  return handleRequest({ method: 'GET', url: `/api/bulk/${jobId}/${batchId}`, params: { type } }, { org }).then(unwrapResponseIgnoreCache);
}
