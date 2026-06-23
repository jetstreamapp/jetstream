/// <reference lib="webworker" />
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  computeFieldUsageWhereUsed,
  FIELD_USAGE_MAX_ROWS_PER_OBJECT,
  runFieldUsageQueryForObjects,
} from '@jetstream/feature/data-analysis';
import { runPermissionExport } from '@jetstream/feature/manage-permissions';
import { logger } from '@jetstream/shared/client-logger';
import { MIME_TYPES } from '@jetstream/shared/constants';
import {
  bulkApiAddBatchToJob,
  bulkApiCreateJob,
  bulkApiGetRecords,
  deleteReportsById,
  queryMore,
  retrieveMetadataFromListMetadata,
  retrieveMetadataFromManifestFile,
  retrieveMetadataFromPackagesNames,
  sobjectOperation,
} from '@jetstream/shared/data';
import {
  getOrgUrlParams,
  isBrowserExtension,
  isCanvasApp,
  pollBulkApiJobUntilDone,
  pollRetrieveMetadataResultsUntilDone,
  prepareCsvFile,
  prepareExcelFile,
} from '@jetstream/shared/ui-utils';
import {
  base64ToArrayBuffer,
  ensureArray,
  flattenRecords,
  getErrorMessage,
  getIdFromRecordUrl,
  getMapOfBaseAndSubqueryRecords,
  getSObjectFromRecordUrl,
  gzipEncode,
  replaceSubqueryQueryResultsWithRecords,
  splitArrayToMaxSize,
} from '@jetstream/shared/utils';
import type {
  AnalysisJobHistoryItem,
  AsyncJobType,
  AsyncJobWorkerMessagePayload,
  AsyncJobWorkerMessageResponse,
  BulkDownloadJob,
  CancelJob,
  DesktopFileDownloadJob,
  FieldUsageAnalysisJob,
  FieldUsageFullResult,
  PermissionExportAnalysisJob,
  RetrievePackageFromListMetadataJob,
  RetrievePackageFromManifestJob,
  RetrievePackageFromPackageNamesJob,
  SalesforceRecord,
  SobjectOperation,
  UploadToGoogleJob,
  WorkerMessage,
} from '@jetstream/types';
import { dexieDb } from '@jetstream/ui/db';
import clamp from 'lodash/clamp';
import isString from 'lodash/isString';

const ANALYSIS_HISTORY_PER_ORG_TYPE_CAP = 10;

async function pruneAnalysisJobHistory(orgUniqueId: string, jobType: AnalysisJobHistoryItem['jobType']): Promise<void> {
  try {
    // Wrap read + delete in a single transaction so a concurrent write (pin/unpin from another tab, or
    // another job finishing on the same org+type) cannot race between the sortBy and the bulkDelete.
    await dexieDb.transaction('rw', dexieDb.analysis_job_history, async () => {
      // sortBy returns ascending by createdAt; reverse the array to put newest first so slice(N) drops the older rows.
      const rowsAscending = await dexieDb.analysis_job_history
        .where('[org+jobType+createdAt]')
        .between([orgUniqueId, jobType, new Date(0)], [orgUniqueId, jobType, new Date(8640000000000000)])
        .sortBy('createdAt');
      const rowsNewestFirst = rowsAscending.slice().reverse();
      const overCap = rowsNewestFirst.filter((row) => !row.pinned).slice(ANALYSIS_HISTORY_PER_ORG_TYPE_CAP);
      if (overCap.length > 0) {
        await dexieDb.analysis_job_history.bulkDelete(overCap.map((row) => row.key));
      }
    });
  } catch (ex) {
    logger.warn('[JOB][ANALYSIS] Failed to prune analysis_job_history', ex);
  }
}

/**
 * This class mimics a web-worker based on what the application uses for these methods
 */
export class WorkerAdapter {
  private jobWorker = new JobWorker((name: string, data: any, error?: any) => {
    this.onmessage({ data: { name, data, error } as any });
  });

  onmessage!: (event: { data: WorkerMessage<AsyncJobType, AsyncJobWorkerMessageResponse> }) => void;

  postMessage = ({ data, name, error }: WorkerMessage<AsyncJobType, AsyncJobWorkerMessagePayload>) => {
    this.jobWorker.handleMessage(name, data);
  };
}

export class JobWorker {
  // Updated if a job is attempted to be canceled, the job will check this on each iteration and cancel if possible
  canceledJobIds = new Set<string>();

  private replyToMessage: (name: string, data: any, error?: any, transferrable?: any) => void;

  constructor(replyToMessage: (name: string, data: any, error?: any, transferrable?: any) => void) {
    this.replyToMessage = replyToMessage;
  }

  public async handleMessage(name: AsyncJobType, payloadData: AsyncJobWorkerMessagePayload, port?: MessagePort) {
    const { org, job, apiVersion } = payloadData || {};
    switch (name) {
      case 'CancelJob': {
        const { job } = payloadData as AsyncJobWorkerMessagePayload<CancelJob>;
        this.canceledJobIds.add(job.id);
        break;
      }
      case 'BulkUndelete':
      case 'BulkDelete': {
        try {
          // TODO: add validation to ensure that we have at least one record
          // also, we are assuming that all records are same SObject
          const MAX_RECORDS_PER_BATCH = 200;

          let { records, batchSize } = job.meta as { records: SalesforceRecord[]; batchSize?: number };
          records = Array.isArray(records) ? records : [records];

          const sobject = getSObjectFromRecordUrl(records[0].attributes.url);

          const isReport = sobject === 'Report';
          const matchBatchSize = isReport ? 25 : 200;

          batchSize = clamp(batchSize || MAX_RECORDS_PER_BATCH, 1, matchBatchSize);

          const allIds: string[] = records.map((record) => getIdFromRecordUrl(record.attributes.url));

          const results: any[] = [];
          const operation: SobjectOperation = name === 'BulkDelete' ? 'delete' : 'undelete';
          for (const ids of splitArrayToMaxSize(allIds, batchSize)) {
            try {
              // TODO: add progress notification and allow cancellation

              if (isReport && operation === 'delete') {
                // Reports cannot be deleted using the sobjectOperation, so we need to use
                // /services/data/v34.0/analytics/reports/00OD0000001cxIE
                const tempResults = await deleteReportsById(org, ids, apiVersion);
                tempResults.forEach((result) => results.push(result));
              } else {
                let tempResults = await sobjectOperation(org, sobject, operation, { ids }, { allOrNone: false });
                tempResults = ensureArray(tempResults);
                tempResults.forEach((result) => results.push(result));
              }
            } catch {
              logger.error('There was a problem deleting these records');
            }
          }

          const response: AsyncJobWorkerMessageResponse = { job, results };
          this.replyToMessage(name, response);
        } catch (ex) {
          const response: AsyncJobWorkerMessageResponse = { job };
          this.replyToMessage(name, response, getErrorMessage(ex));
        }
        break;
      }
      case 'BulkDownload': {
        try {
          const { org, job } = payloadData as AsyncJobWorkerMessagePayload<BulkDownloadJob>;
          const {
            serverUrl,
            sObject,
            soql,
            isTooling,
            fields,
            records,
            hasAllRecords,
            includeDeletedRecords,
            useBulkApi,
            fileFormat,
            fileName,
            subqueryFields,
            includeSubquery,
            googleFolder,
          } = job.meta;
          let mimeType: string;
          let fileData;
          let downloadedRecords = records;

          if (!useBulkApi) {
            // eslint-disable-next-line prefer-const
            let { nextRecordsUrl, totalRecordCount } = job.meta;
            let done = !nextRecordsUrl;

            while (!done && nextRecordsUrl && !hasAllRecords) {
              // emit progress
              const results = {
                done: false,
                progress: Math.floor((downloadedRecords.length / Math.max(totalRecordCount, records.length)) * 100),
              };
              const response: AsyncJobWorkerMessageResponse = { job, lastActivityUpdate: true, results };
              this.replyToMessage(name, response);

              const { queryResults } = await queryMore(org, nextRecordsUrl, isTooling).then(replaceSubqueryQueryResultsWithRecords);
              done = queryResults.done;
              nextRecordsUrl = queryResults.nextRecordsUrl;
              downloadedRecords = downloadedRecords.concat(queryResults.records);
              if (this.canceledJobIds.has(job.id)) {
                throw new Error('Job canceled');
              }
            }
          } else {
            // Submit bulk query job and poll until results are ready
            // Main Browser context will handle downloading the file as a link so it can be streamed
            const jobInfo = await bulkApiCreateJob(org, { type: includeDeletedRecords ? 'QUERY_ALL' : 'QUERY', sObject });
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            const jobId = jobInfo.id!;
            const batchResult = await bulkApiAddBatchToJob(org, jobId, soql, true);

            const response: AsyncJobWorkerMessageResponse = { job, lastActivityUpdate: true };
            this.replyToMessage(name, response, undefined);

            const finalResults = await pollBulkApiJobUntilDone(org, jobInfo, 1, {
              onChecked: () => {
                const response: AsyncJobWorkerMessageResponse = { job, lastActivityUpdate: true };
                this.replyToMessage(name, response, undefined);
              },
            });

            if (finalResults.batches?.[0].state === 'Failed') {
              throw new Error(finalResults.batches[0].stateMessage);
            }

            /**
             * In the browser extension, we cannot stream the file, so we download the results directly
             */
            if (isBrowserExtension() || isCanvasApp()) {
              downloadedRecords = await bulkApiGetRecords(org, jobId, batchResult.id, 'result', true);
            } else {
              const results = {
                done: true,
                progress: 100,
                mimeType: MIME_TYPES.CSV,
                useBulkApi: true,
                results: `${serverUrl}/static/bulk/${jobId}/${batchResult.id}/file?${getOrgUrlParams(org, {
                  type: 'result',
                  isQuery: 'true',
                  fileName,
                }).toString()}`,
                fileName,
                fileFormat,
                googleFolder,
              };
              this.replyToMessage(name, { job, results });
              return;
            }
          }

          switch (fileFormat) {
            case 'xlsx': {
              if (includeSubquery && subqueryFields) {
                fileData = prepareExcelFile(getMapOfBaseAndSubqueryRecords(downloadedRecords, fields, subqueryFields));
              } else {
                fileData = prepareExcelFile(flattenRecords(downloadedRecords, fields), fields);
              }
              mimeType = MIME_TYPES.XLSX;
              break;
            }
            case 'csv': {
              fileData = prepareCsvFile(flattenRecords(downloadedRecords, fields), fields);
              mimeType = MIME_TYPES.CSV;
              break;
            }
            case 'json': {
              fileData = JSON.stringify(downloadedRecords, null, 2);
              mimeType = MIME_TYPES.JSON;
              break;
            }
            case 'gdrive': {
              if (includeSubquery && subqueryFields) {
                fileData = prepareExcelFile(getMapOfBaseAndSubqueryRecords(downloadedRecords, fields, subqueryFields));
              } else {
                fileData = prepareExcelFile(flattenRecords(downloadedRecords, fields), fields);
              }
              mimeType = MIME_TYPES.GSHEET;
              break;
            }
            default:
              throw new Error('A valid file type type has not been selected');
          }

          const results = { done: true, progress: 100, fileData, mimeType, fileName, fileFormat, googleFolder };

          const response: AsyncJobWorkerMessageResponse = { job, results };
          this.replyToMessage(name, response);
        } catch (ex) {
          const response: AsyncJobWorkerMessageResponse = { job };
          this.replyToMessage(name, response, getErrorMessage(ex));
          logger.error('Error in BulkDownload job:', ex);
        }
        break;
      }
      case 'UploadToGoogle': {
        // Message is passed through to jobs.tsx for upload
        try {
          const { job } = payloadData as AsyncJobWorkerMessagePayload<UploadToGoogleJob>;
          const response: AsyncJobWorkerMessageResponse = { job, results: job.meta };
          this.replyToMessage(name, response);
        } catch (ex) {
          const response: AsyncJobWorkerMessageResponse = { job };
          this.replyToMessage(name, response, getErrorMessage(ex));
        }
        break;
      }
      case 'RetrievePackageZip': {
        try {
          const { org, job } = payloadData as AsyncJobWorkerMessagePayload<
            RetrievePackageFromListMetadataJob | RetrievePackageFromManifestJob | RetrievePackageFromPackageNamesJob
          >;
          const { fileName, fileFormat, mimeType, uploadToGoogle, googleFolder } = job.meta;

          let id: string;
          switch (job.meta.type) {
            case 'listMetadata': {
              id = (await retrieveMetadataFromListMetadata(org, job.meta.listMetadataItems)).id;
              break;
            }
            case 'packageManifest': {
              id = (await retrieveMetadataFromManifestFile(org, job.meta.packageManifest)).id;
              break;
            }
            case 'packageNames': {
              id = (await retrieveMetadataFromPackagesNames(org, job.meta.packageNames)).id;
              break;
            }
            default: {
              const response: AsyncJobWorkerMessageResponse = { job };
              this.replyToMessage(name, response, 'An invalid metadata type was provided');
              return;
            }
          }

          if (this.canceledJobIds.has(job.id)) {
            throw new Error('Job canceled');
          }

          const results = await pollRetrieveMetadataResultsUntilDone(org, id, {
            isCanceled: () => {
              return this.canceledJobIds.has(job.id);
            },
            onChecked: () => {
              const response: AsyncJobWorkerMessageResponse = { job, lastActivityUpdate: true };
              this.replyToMessage(name, response, undefined);
            },
          });

          if (isString(results.zipFile)) {
            const fileData = base64ToArrayBuffer(results.zipFile);
            const response: AsyncJobWorkerMessageResponse = {
              job,
              results: { fileData, mimeType, fileName, fileFormat, uploadToGoogle, googleFolder },
            };
            this.replyToMessage(name, response, undefined, fileData);
          } else {
            const response: AsyncJobWorkerMessageResponse = { job };
            this.replyToMessage(name, response, 'No file was provided from Salesforce');
          }
        } catch (ex) {
          const response: AsyncJobWorkerMessageResponse = { job };
          this.replyToMessage(name, response, getErrorMessage(ex));
          if (this.canceledJobIds.has(job.id)) {
            this.canceledJobIds.delete(job.id);
          }
        }
        break;
      }
      case 'PermissionExportAnalysis': {
        const { org, job } = payloadData as AsyncJobWorkerMessagePayload<PermissionExportAnalysisJob>;
        const { jobHistoryKey, profileIds, permissionSetIds, objectApiNames } = job.meta;
        const canceledRef = this.canceledJobIds;
        try {
          const { full } = await runPermissionExport(org, profileIds, permissionSetIds, {
            objectApiNames,
            onProgress: (progress) => {
              const response: AsyncJobWorkerMessageResponse = {
                job,
                lastActivityUpdate: true,
                results: { progress },
              };
              this.replyToMessage(name, response);
            },
            isCanceled: () => canceledRef.has(job.id),
          });

          // Compress + Dexie write can take seconds on large results; keep the UI from sitting silently at 100%.
          this.replyToMessage(name, {
            job,
            lastActivityUpdate: true,
            results: { progress: { current: 1, total: 1, percent: 100, label: 'Compressing and saving results…' } },
          });

          const blob = await gzipEncode(full);
          const now = new Date();
          const historyRow: AnalysisJobHistoryItem = {
            key: jobHistoryKey,
            org: org.uniqueId,
            jobType: 'permission_export',
            status: 'completed',
            requestPayload: full.requestPayload,
            createdAt: now,
            updatedAt: now,
            errorMessage: null,
            pinned: false,
            summary: full.summary,
            resultBlob: blob,
            resultBlobSize: blob.byteLength,
          };
          await dexieDb.analysis_job_history.put(historyRow);
          await pruneAnalysisJobHistory(org.uniqueId, 'permission_export');

          const response: AsyncJobWorkerMessageResponse = {
            job,
            results: { jobHistoryKey, summary: full.summary },
          };
          this.replyToMessage(name, response);
        } catch (ex) {
          const errorMessage = getErrorMessage(ex);
          const wasCanceled = this.canceledJobIds.has(job.id);
          if (!wasCanceled) {
            try {
              const now = new Date();
              const failedRow: AnalysisJobHistoryItem = {
                key: jobHistoryKey,
                org: org.uniqueId,
                jobType: 'permission_export',
                status: 'failed',
                requestPayload: {
                  profileIds,
                  permissionSetIds,
                  ...(objectApiNames !== undefined ? { objectApiNames } : {}),
                },
                createdAt: now,
                updatedAt: now,
                errorMessage,
                pinned: false,
                summary: null,
                resultBlob: null,
                resultBlobSize: 0,
              };
              await dexieDb.analysis_job_history.put(failedRow);
              await pruneAnalysisJobHistory(org.uniqueId, 'permission_export');
            } catch (writeEx) {
              logger.warn('[JOB][PERMISSION_EXPORT] Failed to record failed analysis_job_history row', writeEx);
            }
          }

          const response: AsyncJobWorkerMessageResponse = { job };
          this.replyToMessage(name, response, errorMessage);
        } finally {
          // Always clear the cancel flag (success, failure, or cancel) so the Set doesn't accumulate stale ids.
          canceledRef.delete(job.id);
        }
        break;
      }
      case 'FieldUsageAnalysis': {
        const { org, job } = payloadData as AsyncJobWorkerMessagePayload<FieldUsageAnalysisJob>;
        const { jobHistoryKey, objectApiNames, loadFullScan } = job.meta;
        const canceledRef = this.canceledJobIds;
        try {
          const queryOutcome = await runFieldUsageQueryForObjects(org, objectApiNames, {
            loadFullScan,
            onProgress: (progress) => {
              const response: AsyncJobWorkerMessageResponse = {
                job,
                lastActivityUpdate: true,
                results: { progress },
              };
              this.replyToMessage(name, response);
            },
            isCanceled: () => canceledRef.has(job.id),
          });

          // The where-used phase has no per-item progress; tell the UI what's happening so it doesn't appear frozen.
          this.replyToMessage(name, {
            job,
            lastActivityUpdate: true,
            results: {
              progress: {
                current: objectApiNames.length,
                total: objectApiNames.length,
                percent: 100,
                label: 'Resolving field dependencies (Where Used)…',
              },
            },
          });

          let whereUsed: Record<string, unknown[]> = {};
          let whereUsedResolvedFieldKeys: string[] = [];
          let whereUsedComputed = true;
          try {
            const whereUsedOutcome = await computeFieldUsageWhereUsed(org, queryOutcome.objects);
            whereUsed = whereUsedOutcome.whereUsed as unknown as Record<string, unknown[]>;
            whereUsedResolvedFieldKeys = whereUsedOutcome.resolvedFieldKeys;
          } catch (whereUsedEx) {
            logger.warn('[JOB][FIELD_USAGE] where-used lookup failed; continuing without map', whereUsedEx);
            whereUsed = {};
            whereUsedResolvedFieldKeys = [];
            whereUsedComputed = false;
          }
          // Where-used can take a while; respect a cancel requested during that phase before we persist a "completed" row.
          if (canceledRef.has(job.id)) {
            throw new Error('Job canceled');
          }

          const okObjectCount = objectApiNames.filter(
            (objectApiName) => !queryOutcome.failedObjects.includes(objectApiName) && !queryOutcome.objects[objectApiName]?.error,
          ).length;
          const summaryParts = [
            `Field Usage for ${okObjectCount}/${objectApiNames.length} Object(s).${loadFullScan ? ' No per-object row cap.' : ''}`,
            queryOutcome.anyQueryTruncated
              ? loadFullScan
                ? 'Some objects may still show truncated scans for very large data sets or API limits.'
                : `Row scan capped at ${String(FIELD_USAGE_MAX_ROWS_PER_OBJECT)} rows per Object where noted.`
              : '',
            queryOutcome.failedObjects.length > 0 ? `Failed: ${queryOutcome.failedObjects.join(', ')}.` : '',
          ].filter(Boolean);
          const summary = summaryParts.join(' ');

          const full: FieldUsageFullResult = {
            requestPayload: {
              objectApiNames,
              ...(loadFullScan !== undefined ? { loadFullScan } : {}),
            },
            phase: 'field_usage_v1',
            summary,
            truncated: queryOutcome.anyQueryTruncated,
            failedObjects: queryOutcome.failedObjects,
            whereUsedComputed,
            whereUsedResolvedFieldKeys,
            objects: queryOutcome.objects as unknown as FieldUsageFullResult['objects'],
            whereUsed: whereUsed as unknown as FieldUsageFullResult['whereUsed'],
          };

          // Compress + Dexie write can take seconds on large results; keep the UI from sitting silently at 100%.
          this.replyToMessage(name, {
            job,
            lastActivityUpdate: true,
            results: {
              progress: {
                current: objectApiNames.length,
                total: objectApiNames.length,
                percent: 100,
                label: 'Compressing and saving results…',
              },
            },
          });

          const blob = await gzipEncode(full);
          const now = new Date();
          const historyRow: AnalysisJobHistoryItem = {
            key: jobHistoryKey,
            org: org.uniqueId,
            jobType: 'field_usage',
            status: 'completed',
            requestPayload: full.requestPayload,
            createdAt: now,
            updatedAt: now,
            errorMessage: null,
            pinned: false,
            summary,
            resultBlob: blob,
            resultBlobSize: blob.byteLength,
          };
          await dexieDb.analysis_job_history.put(historyRow);
          await pruneAnalysisJobHistory(org.uniqueId, 'field_usage');

          const response: AsyncJobWorkerMessageResponse = {
            job,
            results: { jobHistoryKey, summary },
          };
          this.replyToMessage(name, response);
        } catch (ex) {
          const errorMessage = getErrorMessage(ex);
          const wasCanceled = this.canceledJobIds.has(job.id);
          if (!wasCanceled) {
            try {
              const now = new Date();
              const failedRow: AnalysisJobHistoryItem = {
                key: jobHistoryKey,
                org: org.uniqueId,
                jobType: 'field_usage',
                status: 'failed',
                requestPayload: {
                  objectApiNames,
                  ...(loadFullScan !== undefined ? { loadFullScan } : {}),
                },
                createdAt: now,
                updatedAt: now,
                errorMessage,
                pinned: false,
                summary: null,
                resultBlob: null,
                resultBlobSize: 0,
              };
              await dexieDb.analysis_job_history.put(failedRow);
              await pruneAnalysisJobHistory(org.uniqueId, 'field_usage');
            } catch (writeEx) {
              logger.warn('[JOB][FIELD_USAGE] Failed to record failed analysis_job_history row', writeEx);
            }
          }

          const response: AsyncJobWorkerMessageResponse = { job };
          this.replyToMessage(name, response, errorMessage);
        } finally {
          // Always clear the cancel flag (success, failure, or cancel) so the Set doesn't accumulate stale ids.
          canceledRef.delete(job.id);
        }
        break;
      }
      case 'DesktopFileDownload': {
        try {
          const { org, job } = payloadData as AsyncJobWorkerMessagePayload<DesktopFileDownloadJob>;
          const { fileName, nameFormat, recordIds, sobjectName } = job.meta;
          if (!window.electronAPI?.downloadZipToFile) {
            throw new Error('Electron API not available');
          }
          const result = await window.electronAPI?.downloadZipToFile({
            orgId: org.uniqueId,
            sobject: sobjectName.toLowerCase(),
            recordIds,
            nameFormat,
            fileName,
            jobId: job.id,
          });

          const response: AsyncJobWorkerMessageResponse = {
            job,
            results: result,
          };

          this.replyToMessage(name, response);
        } catch (ex) {
          const response: AsyncJobWorkerMessageResponse = { job };
          this.replyToMessage(name, response, getErrorMessage(ex));
        }
        break;
      }
      default:
        break;
    }
  }
}
