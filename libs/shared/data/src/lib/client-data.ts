/* eslint-disable @typescript-eslint/no-explicit-any */
import { HTTP, MIME_TYPES } from '@jetstream/shared/constants';
import {
  AnonymousApexResponse,
  ApexCompletionResponse,
  ApiResponse,
  AsyncResult,
  BulkApiCreateJobRequestPayload,
  BulkApiDownloadType,
  BulkJob,
  BulkJobBatchInfo,
  BulkJobWithBatches,
  ChildRelationship,
  CloudinarySignature,
  CloudinaryUploadResponse,
  DeployOptions,
  DeployResult,
  DescribeGlobalResult,
  DescribeMetadataResult,
  DescribeSObjectResult,
  GenericRequestPayload,
  GoogleFileApiResponse,
  InputReadFileContent,
  ListMetadataQuery,
  ListMetadataResult,
  ListMetadataResultRaw,
  ManualRequestPayload,
  ManualRequestResponse,
  OperationReturnType,
  QueryResults,
  RetrieveResult,
  SalesforceApiRequest,
  SalesforceOrgUi,
  SobjectOperation,
  UserProfileUi,
  UserProfileUiWithIdentities,
} from '@jetstream/types';
import { parseISO } from 'date-fns/parseISO';
import isFunction from 'lodash/isFunction';
import isNil from 'lodash/isNil';
import { handleExternalRequest, handleRequest, transformListMetadataResponse } from './client-data-data-helper';
//// LANDING PAGE ROUTES

let cloudinarySignature: CloudinarySignature;

function unwrapResponseIgnoreCache<T>(response: ApiResponse<T>) {
  return response.data;
}

// duplicated here to avoid circular dependency :shrug:
function convertDateToLocale(dateOrIsoDateString?: string | Date, options?: Intl.DateTimeFormatOptions): string | undefined {
  if (isNil(dateOrIsoDateString)) {
    return dateOrIsoDateString;
  }
  const date = dateOrIsoDateString instanceof Date ? dateOrIsoDateString : parseISO(dateOrIsoDateString);
  if (!options) {
    return date.toLocaleString();
  } else {
    return new Intl.DateTimeFormat(navigator.language, options).format(date);
  }
}

//// APPLICATION ROUTES

export async function checkHeartbeat(): Promise<{ version: string }> {
  return handleRequest({ method: 'GET', url: '/api/heartbeat' }).then(unwrapResponseIgnoreCache);
}

export async function emailSupport(emailBody: string, attachments: InputReadFileContent[]): Promise<void> {
  const form = new FormData();
  form.append('emailBody', emailBody);
  attachments.forEach((attachment) => form.append('files', new Blob([attachment.content]), attachment.filename));
  return handleRequest({ method: 'POST', url: '/api/support/email', data: form }).then(unwrapResponseIgnoreCache);
}

export async function getUserProfile(): Promise<UserProfileUi> {
  return handleRequest({ method: 'GET', url: '/api/me' }).then(unwrapResponseIgnoreCache);
}

export async function deleteUserProfile(reason?: string): Promise<void> {
  return handleRequest({ method: 'DELETE', url: '/api/me', data: { reason } }).then(unwrapResponseIgnoreCache);
}

export async function getFullUserProfile(): Promise<UserProfileUiWithIdentities> {
  return handleRequest({ method: 'GET', url: '/api/me/profile' }).then(unwrapResponseIgnoreCache);
}

export async function updateUserProfile(userProfile: { name: string }): Promise<UserProfileUiWithIdentities> {
  return handleRequest({ method: 'POST', url: '/api/me/profile', data: userProfile }).then(unwrapResponseIgnoreCache);
}

export async function unlinkIdentityFromProfile(identity: { provider: string; userId: string }): Promise<UserProfileUiWithIdentities> {
  return handleRequest({ method: 'DELETE', url: '/api/me/profile/identity', params: identity }).then(unwrapResponseIgnoreCache);
}

export async function resendVerificationEmail(identity: { provider: string; userId: string }): Promise<void> {
  return handleRequest({ method: 'POST', url: '/api/me/profile/identity/verify-email', params: identity }).then(unwrapResponseIgnoreCache);
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

export async function checkOrgHealth(org: SalesforceOrgUi): Promise<void> {
  return handleRequest({ method: 'POST', url: `/api/orgs/health-check` }, { org }).then(unwrapResponseIgnoreCache);
}

/**
 * First an upload signature is obtained from the server, if needed (good for 1 hour)
 * Then images are uploaded directly to cloudinary
 *
 * https://cloudinary.com/documentation/upload_images#example_2_upload_multiple_files_using_a_form_signed
 *
 * @param files
 * @returns
 */
export async function uploadImage(image: { content: string }): Promise<CloudinaryUploadResponse> {
  // signatures are available for 1 hour, using a 5 minute buffer
  const earliestValidTimestamp = Math.round(new Date().getTime() / 1000) - 60 * 55;
  if (!cloudinarySignature || cloudinarySignature.timestamp >= earliestValidTimestamp) {
    cloudinarySignature = await handleRequest<CloudinarySignature>({ method: 'GET', url: '/api/images/upload-signature' }).then(
      unwrapResponseIgnoreCache
    );
  }
  const { apiKey, cloudName, context, signature, timestamp } = cloudinarySignature;

  const formData = new FormData();
  formData.append('file', image.content);
  formData.append('api_key', apiKey);
  formData.append('timestamp', `${timestamp}`);
  formData.append('signature', signature);
  formData.append('upload_preset', 'jetstream-issues');
  formData.append('context', context);

  return handleExternalRequest({
    method: 'POST',
    url: `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
    data: formData,
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(unwrapResponseIgnoreCache);
}

/**
 * https://cloudinary.com/documentation/upload_images#deleting_client_side_uploaded_assets
 */
export async function deleteImage(deleteToken: string): Promise<CloudinaryUploadResponse> {
  const { cloudName } = cloudinarySignature;

  const formData = new FormData();
  formData.append('token', deleteToken);

  return handleExternalRequest({
    method: 'POST',
    url: `https://api.cloudinary.com/v1_1/${cloudName}/delete_by_token`,
    data: formData,
    headers: { 'Content-Type': 'multipart/form-data' },
  }).then(unwrapResponseIgnoreCache);
}

export async function describeGlobal(
  org: SalesforceOrgUi,
  isTooling = false,
  skipRequestCache = false
): Promise<ApiResponse<DescribeGlobalResult>> {
  return handleRequest(
    { method: 'GET', url: '/api/describe', params: { isTooling } },
    { org, useCache: true, skipRequestCache, useQueryParamsInCacheKey: true }
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
  ).then((results: ApiResponse<DescribeSObjectResult>) => {
    // There are some rare circumstances where objects have duplicate child relationships which breaks things
    // This is a Salesforce bug, but the best we can do is ignore duplicates
    // Most notable example is Salesforce CPQ's SBQQ__Quote__c object which has two child relationships named `FinanceBalanceSnapshots`
    results.data.childRelationships = results.data.childRelationships.reduce(
      (
        acc: {
          childRelationships: ChildRelationship[];
          previouslySeenRelationships: Set<string>;
        },
        item
      ) => {
        if (!item.relationshipName || !acc.previouslySeenRelationships.has(item.relationshipName)) {
          acc.childRelationships.push(item);
        }
        item.relationshipName && acc.previouslySeenRelationships.add(item.relationshipName);
        return acc;
      },
      {
        childRelationships: [],
        previouslySeenRelationships: new Set<string>(),
      }
    ).childRelationships;
    return results;
  });
}

export async function query<T = any>(
  org: SalesforceOrgUi,
  query: string,
  isTooling = false,
  includeDeletedRecords = false
): Promise<QueryResults<T>> {
  return handleRequest(
    { method: 'POST', url: `/api/query`, params: { isTooling, includeDeletedRecords }, data: { query } },
    { org, useQueryParamsInCacheKey: true, useBodyInCacheKey: true }
  ).then(unwrapResponseIgnoreCache);
}

export async function queryWithCache<T = any>(
  org: SalesforceOrgUi,
  query: string,
  isTooling = false,
  skipRequestCache = false,
  includeDeletedRecords = false
): Promise<ApiResponse<QueryResults<T>>> {
  return handleRequest(
    { method: 'POST', url: `/api/query`, params: { isTooling, includeDeletedRecords }, data: { query } },
    { org, useCache: true, skipRequestCache, useQueryParamsInCacheKey: true, useBodyInCacheKey: true }
  );
}

export async function queryMore<T = any>(org: SalesforceOrgUi, nextRecordsUrl: string, isTooling = false): Promise<QueryResults<T>> {
  return handleRequest({ method: 'GET', url: `/api/query-more`, params: { nextRecordsUrl, isTooling } }, { org }).then(
    unwrapResponseIgnoreCache
  );
}

export async function queryMoreWithCache<T = any>(
  org: SalesforceOrgUi,
  nextRecordsUrl: string,
  isTooling = false
): Promise<QueryResults<T>> {
  return handleRequest(
    { method: 'GET', url: `/api/query-more`, params: { nextRecordsUrl, isTooling } },
    { org, useCache: true, useQueryParamsInCacheKey: true }
  ).then(unwrapResponseIgnoreCache);
}

/**
 * If a query needs to be split up because it is too long, this function will query multiple SOQL queries
 * and combine all the results.
 * @param org
 * @param soqlQueries
 * @param isTooling
 * @param includeDeletedRecords
 * @returns
 */
export async function queryAllFromList<T = any>(
  org: SalesforceOrgUi,
  soqlQueries: string[],
  isTooling = false,
  includeDeletedRecords = false
): Promise<QueryResults<T>> {
  let results;
  for (const soqlQuery of soqlQueries) {
    const _results = await queryAll(org, soqlQuery, isTooling, includeDeletedRecords);
    if (!results) {
      results = _results;
    } else {
      results.queryResults.records = results.queryResults.records.concat(_results.queryResults.records);
    }
  }
  return results;
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
  includeDeletedRecords = false,
  // Ended up not using onProgress - if used, need to test
  onProgress?: (fetched: number, total: number) => void
): Promise<QueryResults<T>> {
  const results = await query(org, soqlQuery, isTooling, includeDeletedRecords);
  if (!results.queryResults.done && results.queryResults.nextRecordsUrl) {
    let progress: { initialFetched: number; onProgress?: (fetched: number, total: number) => void } | undefined = undefined;
    if (isFunction(onProgress)) {
      onProgress(results.queryResults.records.length, results.queryResults.totalSize);
      progress = {
        initialFetched: results.queryResults.records.length,
        onProgress,
      };
    }
    const currentResults = await queryRemaining(org, results.queryResults.nextRecordsUrl, isTooling, progress);
    results.queryResults.records = results.queryResults.records.concat(currentResults.queryResults.records);
    results.queryResults.nextRecordsUrl = undefined;
    results.queryResults.done = true;
  }
  return results;
}

/**
 * Query all remaining records starting with a query locator
 *
 * @param org
 * @param soqlQuery
 * @param isTooling
 * @param includeDeletedRecords
 */
export async function queryRemaining<T = any>(
  org: SalesforceOrgUi,
  nextRecordsUrl: string,
  isTooling = false,
  progress?: {
    initialFetched: number;
    onProgress?: (fetched: number, total: number) => void;
  }
): Promise<QueryResults<T>> {
  const results = await queryMore(org, nextRecordsUrl, isTooling);
  while (!results.queryResults.done && results.queryResults.nextRecordsUrl) {
    if (progress && isFunction(progress.onProgress)) {
      progress.onProgress(results.queryResults.records.length + progress.initialFetched, results.queryResults.totalSize);
    }
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
 * Same as queryAll, but caches results
 */
export async function queryAllWithCache<T = any>(
  org: SalesforceOrgUi,
  soqlQuery: string,
  isTooling = false,
  includeDeletedRecords = false,
  // Ended up not using onProgress - if used, need to test
  onProgress?: (fetched: number, total: number) => void
): Promise<ApiResponse<QueryResults<T>>> {
  const { data: results, cache } = await queryWithCache(org, soqlQuery, isTooling, false, includeDeletedRecords);
  if (!results.queryResults.done && results.queryResults.nextRecordsUrl) {
    let progress: { initialFetched: number; onProgress?: (fetched: number, total: number) => void } | undefined = undefined;
    if (isFunction(onProgress)) {
      onProgress(results.queryResults.records.length, results.queryResults.totalSize);
      progress = {
        initialFetched: results.queryResults.records.length,
        onProgress,
      };
    }
    const currentResults = await queryRemainingWithCache(org, results.queryResults.nextRecordsUrl, isTooling, progress);
    results.queryResults.records = results.queryResults.records.concat(currentResults.queryResults.records);
    results.queryResults.nextRecordsUrl = undefined;
    results.queryResults.done = true;
  }
  return { data: results, cache };
}

/**
 * Same as queryRemaining, but caches results
 */
export async function queryRemainingWithCache<T = any>(
  org: SalesforceOrgUi,
  nextRecordsUrl: string,
  isTooling = false,
  progress?: {
    initialFetched: number;
    onProgress?: (fetched: number, total: number) => void;
  }
): Promise<QueryResults<T>> {
  const results = await queryMoreWithCache(org, nextRecordsUrl, isTooling);
  while (!results.queryResults.done && results.queryResults.nextRecordsUrl) {
    if (progress && isFunction(progress.onProgress)) {
      progress.onProgress(results.queryResults.records.length + progress.initialFetched, results.queryResults.totalSize);
    }
    const currentResults = await queryMoreWithCache(org, results.queryResults.nextRecordsUrl, isTooling);
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
): Promise<QueryResults<T>> {
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

export async function sobjectOperation<O extends SobjectOperation>(
  org: SalesforceOrgUi,
  sobject: string,
  operation: SobjectOperation,
  body: {
    ids?: string[]; // required for retrieve | create | delete
    records?: any[]; // required for create | update | upsert
  },
  query: {
    externalId?: string;
    allOrNone?: boolean;
  } = {}
): Promise<OperationReturnType<O, any>> {
  // FIXME: add type for R as the first generic type in function
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
  skipRequestCache = false,
  skipCacheIfOlderThan?: number // timestamp -> new Date().getTime()
): Promise<ApiResponse<ListMetadataResult[]>> {
  return handleRequest<ListMetadataResultRaw[]>(
    { method: 'POST', url: `/api/metadata/list`, data: { types } },
    { org, useCache: true, skipRequestCache, skipCacheIfOlderThan, useBodyInCacheKey: true }
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
  payload: Record<string, ListMetadataResult[]>
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
  }: { id: string; deployOptions?: DeployOptions; replacementPackageXml?: string; changesetName?: string }
): Promise<{ type: 'deploy' | 'retrieve'; results: RetrieveResult; zipFile?: string }> {
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
  metadata: Record<string, ListMetadataResult[]>,
  otherFields: Record<string, string> = {}
): Promise<string> {
  return handleRequest({ method: 'POST', url: `/api/metadata/package-xml`, data: { metadata, otherFields } }, { org }).then(
    unwrapResponseIgnoreCache
  );
}

export async function genericRequest<T = any>(org: SalesforceOrgUi, payload: GenericRequestPayload): Promise<T> {
  return handleRequest({ method: 'POST', url: `/api/request`, data: payload }, { org }).then(unwrapResponseIgnoreCache);
}

export async function manualRequest(org: SalesforceOrgUi, payload: ManualRequestPayload): Promise<ManualRequestResponse> {
  return handleRequest({ method: 'POST', url: `/api/request-manual`, data: payload }, { org }).then(unwrapResponseIgnoreCache);
}

export async function bulkApiCreateJob(org: SalesforceOrgUi, payload: BulkApiCreateJobRequestPayload): Promise<BulkJobWithBatches> {
  return handleRequest({ method: 'POST', url: `/api/bulk`, data: payload }, { org }).then(unwrapResponseIgnoreCache);
}

export async function bulkApiCancelJob(org: SalesforceOrgUi, payload: BulkApiCreateJobRequestPayload): Promise<BulkJobWithBatches> {
  return handleRequest({ method: 'POST', url: `/api/bulk`, data: payload }, { org }).then(unwrapResponseIgnoreCache);
}

export async function bulkApiGetJob(org: SalesforceOrgUi, jobId: string): Promise<BulkJobWithBatches> {
  return handleRequest<BulkJobWithBatches>({ method: 'GET', url: `/api/bulk/${jobId}` }, { org })
    .then(unwrapResponseIgnoreCache)
    .then((results) => {
      results.batches.forEach((batch) => {
        batch.createdDate = convertDateToLocale(batch.createdDate, { timeStyle: 'medium' });
        batch.systemModstamp = convertDateToLocale(batch.systemModstamp, { timeStyle: 'medium' });
      });
      return results;
    });
}

export async function bulkApiCloseJob(org: SalesforceOrgUi, jobId: string): Promise<BulkJob> {
  return handleRequest({ method: 'DELETE', url: `/api/bulk/${jobId}/close` }, { org }).then(unwrapResponseIgnoreCache);
}

export async function bulkApiAbortJob(org: SalesforceOrgUi, jobId: string): Promise<BulkJob> {
  return handleRequest({ method: 'DELETE', url: `/api/bulk/${jobId}/abort` }, { org }).then(unwrapResponseIgnoreCache);
}

export async function bulkApiAddBatchToJob(
  org: SalesforceOrgUi,
  jobId: string,
  csv: string,
  closeJob?: boolean
): Promise<BulkJobBatchInfo> {
  return handleRequest<BulkJobBatchInfo>(
    {
      method: 'POST',
      url: `/api/bulk/${jobId}`,
      data: csv,
      params: { closeJob },
      headers: { [HTTP.HEADERS.CONTENT_TYPE]: HTTP.CONTENT_TYPE.CSV },
    },
    { org }
  )
    .then(unwrapResponseIgnoreCache)
    .then((result) => {
      result.createdDate = convertDateToLocale(result.createdDate, { timeStyle: 'medium' });
      result.systemModstamp = convertDateToLocale(result.systemModstamp, { timeStyle: 'medium' });
      return result;
    });
}

export async function bulkApiAddBatchToJobWithAttachment(
  org: SalesforceOrgUi,
  jobId: string,
  data: ArrayBuffer
): Promise<BulkJobBatchInfo> {
  return handleRequest(
    { method: 'POST', url: `/api/bulk/zip/${jobId}`, data, headers: { [HTTP.HEADERS.CONTENT_TYPE]: HTTP.CONTENT_TYPE.ZIP } },
    { org }
  ).then(unwrapResponseIgnoreCache);
}

export async function bulkApiGetRecords<T = any>(
  org: SalesforceOrgUi,
  jobId: string,
  batchId: string,
  type: BulkApiDownloadType,
  isQuery?: boolean
): Promise<T[]> {
  return handleRequest({ method: 'GET', url: `/api/bulk/${jobId}/${batchId}`, params: { type, isQuery } }, { org }).then(
    unwrapResponseIgnoreCache
  );
}

export async function anonymousApex(org: SalesforceOrgUi, apex: string, logLevel: string): Promise<AnonymousApexResponse> {
  return handleRequest({ method: 'POST', url: `/api/apex/anonymous`, data: { apex, logLevel } }, { org }).then(unwrapResponseIgnoreCache);
}

export async function apexCompletions(org: SalesforceOrgUi, type: 'apex' | 'visualforce' = 'apex'): Promise<ApexCompletionResponse> {
  return handleRequest({ method: 'GET', url: `/api/apex/completions/${type}` }, { org, useCache: true }).then(unwrapResponseIgnoreCache);
}

export async function salesforceApiReq(): Promise<SalesforceApiRequest[]> {
  return handleRequest({ method: 'GET', url: `/api/salesforce-api/requests` }, { useCache: true }).then(unwrapResponseIgnoreCache);
}

export async function googleUploadFile(
  accessToken: string,
  { fileMimeType, filename, folderId, fileData }: { fileMimeType: string; filename: string; folderId?: string | null; fileData: any },
  targetMimeType = MIME_TYPES.GSHEET
): Promise<GoogleFileApiResponse & { webViewLink: string }> {
  return await handleExternalRequest({
    method: 'POST',
    url: `https://www.googleapis.com/upload/drive/v3/files`,
    headers: {
      'X-Upload-Content-Type': fileMimeType,
      'Content-Type': HTTP.CONTENT_TYPE.JSON,
      Authorization: `Bearer ${accessToken}`,
    },
    params: {
      uploadType: 'resumable',
      supportsAllDrives: true,
      fields: 'webViewLink',
    },
    data: {
      name: filename,
      mimeType: targetMimeType.replace(';charset=utf-8', ''),
      parents: folderId ? [folderId] : undefined,
    },
  })
    .then((response) => ({ url: response.headers.location, fileId: response.headers['x-guploader-uploadid'] }))
    .then(({ url }) =>
      handleExternalRequest<GoogleFileApiResponse & { webViewLink: string }>({
        method: 'PUT',
        url,
        headers: { Authorization: `Bearer ${accessToken}` },
        data: fileData,
      })
    )
    .then((response) => response.data);
}
