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
  GenericRequestPayload,
  SalesforceOrgUi,
  SobjectOperation,
  UserProfileUi,
} from '@jetstream/types';
import { AsyncResult, DeployOptions, DeployResult, DescribeGlobalResult, DescribeSObjectResult } from 'jsforce';
import { handleRequest } from './client-data-data-helper';
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

export async function deleteOrg(org: SalesforceOrgUi): Promise<void> {
  return handleRequest({ method: 'DELETE', url: `/api/orgs/${org.uniqueId}` }).then(unwrapResponseIgnoreCache);
}

export async function describeGlobal(org: SalesforceOrgUi): Promise<ApiResponse<DescribeGlobalResult>> {
  return handleRequest({ method: 'GET', url: '/api/describe' }, { org, useCache: true }).then(
    (response: ApiResponse<DescribeGlobalResult>) => {
      if (response.data && Array.isArray(response.data.sobjects)) {
        response.data.sobjects.forEach((sobject) => {
          if (sobject.label.startsWith('__MISSING LABEL__')) {
            sobject.label = sobject.name;
          }
        });
      }
      return response;
    }
  );
}

export async function describeSObject(org: SalesforceOrgUi, SObject: string): Promise<ApiResponse<DescribeSObjectResult>> {
  return handleRequest(
    { method: 'GET', url: `/api/describe/${SObject}` },
    { org, useCache: true, mockHeaderKey: SObject.startsWith('@') ? SObject : undefined }
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
  return handleRequest({ method: 'POST', url: `/api/record/${operation}/${sobject}`, params: { query }, data: body }, { org }).then(
    unwrapResponseIgnoreCache
  );
}

// TODO:
// export async function listMetadata<T = any>(org: SalesforceOrgUi, query: string, isTooling = false): Promise<API.QueryResults<T>> {
//   return handleRequest(request.post(`/api/query`).query({ isTooling }).send({ query }), org);
// }

export async function readMetadata<T = any>(org: SalesforceOrgUi, type: string, fullNames: string[]): Promise<T[]> {
  return handleRequest({ method: 'POST', url: `/api/metadata/read/${type}`, data: { fullNames } }, { org }).then(unwrapResponseIgnoreCache);
}

// we should also have an option to stream a zip file (build when we have future requirements)
export async function deployMetadata(
  org: SalesforceOrgUi,
  files: { fullFilename: string; content: string }[],
  options?: DeployOptions
): Promise<AsyncResult> {
  return handleRequest({ method: 'POST', url: `/api/metadata/deploy`, data: { files, options } }, { org }).then(unwrapResponseIgnoreCache);
}

export async function checkMetadataResults(org: SalesforceOrgUi, id: string, includeDetails = false): Promise<DeployResult> {
  return handleRequest({ method: 'GET', url: `/api/metadata/deploy/${id}`, params: { includeDetails } }, { org }).then(
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
