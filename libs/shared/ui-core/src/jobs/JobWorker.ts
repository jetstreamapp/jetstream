/// <reference lib="webworker" />
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  base64ToArrayBuffer,
  getOrgUrlParams,
  pollBulkApiJobUntilDone,
  pollRetrieveMetadataResultsUntilDone,
  prepareCsvFile,
  prepareExcelFile,
} from '@jetstream/shared/browser-worker-utils';
import { logger } from '@jetstream/shared/client-logger';
import { MIME_TYPES } from '@jetstream/shared/constants';
import {
  bulkApiAddBatchToJob,
  bulkApiCreateJob,
  queryMore,
  retrieveMetadataFromListMetadata,
  retrieveMetadataFromManifestFile,
  retrieveMetadataFromPackagesNames,
  sobjectOperation,
} from '@jetstream/shared/data';
import {
  ensureArray,
  flattenRecords,
  getErrorMessage,
  getIdFromRecordUrl,
  getMapOfBaseAndSubqueryRecords,
  getSObjectFromRecordUrl,
  replaceSubqueryQueryResultsWithRecords,
  splitArrayToMaxSize,
} from '@jetstream/shared/utils';
import type {
  AsyncJobType,
  AsyncJobWorkerMessagePayload,
  AsyncJobWorkerMessageResponse,
  BulkDownloadJob,
  CancelJob,
  RetrievePackageFromListMetadataJob,
  RetrievePackageFromManifestJob,
  RetrievePackageFromPackageNamesJob,
  SalesforceRecord,
  UploadToGoogleJob,
  WorkerMessage,
} from '@jetstream/types';
import clamp from 'lodash/clamp';
import isString from 'lodash/isString';

/**
 * This class mimics a web-worker based on what the application uses for these methods
 */
export class WorkerAdapter {
  private jobWorker = new JobWorker((name: string, data: any, error?: any) => {
    this.onmessage({ data: { name, data, error } as any });
  });

  onmessage: (event: { data: WorkerMessage<AsyncJobType, AsyncJobWorkerMessageResponse> }) => void;

  postMessage = ({ data, name, error }: WorkerMessage<AsyncJobType, AsyncJobWorkerMessagePayload>) => {
    this.jobWorker.handleMessage(name, data);
  };
}

export class JobWorker {
  // Updated if a job is attempted to be cancelled, the job will check this on each iteration and cancel if possible
  cancelledJobIds = new Set<string>();

  private replyToMessage: (name: string, data: any, error?: any, transferrable?: any) => void;

  constructor(replyToMessage: (name: string, data: any, error?: any, transferrable?: any) => void) {
    this.replyToMessage = replyToMessage;
  }

  public async handleMessage(name: AsyncJobType, payloadData: AsyncJobWorkerMessagePayload, port?: MessagePort) {
    const { org, job } = payloadData || {};
    switch (name) {
      case 'CancelJob': {
        const { job } = payloadData as AsyncJobWorkerMessagePayload<CancelJob>;
        this.cancelledJobIds.add(job.id);
        break;
      }
      case 'BulkDelete': {
        try {
          // TODO: add validation to ensure that we have at least one record
          // also, we are assuming that all records are same SObject
          const MAX_DELETE_RECORDS = 200;

          let { records, batchSize } = job.meta as { records: SalesforceRecord[]; batchSize?: number };
          records = Array.isArray(records) ? records : [records];

          batchSize = clamp(batchSize || MAX_DELETE_RECORDS, 1, 200);

          const sobject = getSObjectFromRecordUrl(records[0].attributes.url);
          const allIds: string[] = records.map((record) => getIdFromRecordUrl(record.attributes.url));

          const results: any[] = [];
          for (const ids of splitArrayToMaxSize(allIds, batchSize)) {
            try {
              // TODO: add progress notification and allow cancellation
              let tempResults = await sobjectOperation(org, sobject, 'delete', { ids }, { allOrNone: false });
              tempResults = ensureArray(tempResults);
              tempResults.forEach((result) => results.push(result));
            } catch (ex) {
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
              if (this.cancelledJobIds.has(job.id)) {
                throw new Error('Job cancelled');
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

            const results = {
              done: true,
              progress: 100,
              mimeType: MIME_TYPES.CSV,
              useBulkApi: true,
              results: `${serverUrl}/static/bulk/${jobId}/${batchResult.id}/file?${getOrgUrlParams(org, {
                type: 'result',
                isQuery: 'true',
                fileName,
              })}`,
              fileName,
              fileFormat,
              googleFolder,
            };
            this.replyToMessage(name, { job, results });
            return;
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

          const results = { done: true, progress: 100, fileData, mimeType: '', fileName, fileFormat, googleFolder };

          const response: AsyncJobWorkerMessageResponse = { job, results };
          this.replyToMessage(name, response);
        } catch (ex) {
          const response: AsyncJobWorkerMessageResponse = { job };
          this.replyToMessage(name, response, getErrorMessage(ex));
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

          if (this.cancelledJobIds.has(job.id)) {
            throw new Error('Job cancelled');
          }

          const results = await pollRetrieveMetadataResultsUntilDone(org, id, {
            isCancelled: () => {
              return this.cancelledJobIds.has(job.id);
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
          if (this.cancelledJobIds.has(job.id)) {
            this.cancelledJobIds.delete(job.id);
          }
        }
        break;
      }
      default:
        break;
    }
  }
}
