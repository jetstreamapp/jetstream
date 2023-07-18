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
  initForElectron,
  queryMore,
  retrieveMetadataFromListMetadata,
  retrieveMetadataFromManifestFile,
  retrieveMetadataFromPackagesNames,
  sobjectOperation,
} from '@jetstream/shared/data';
import {
  flattenRecords,
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
  UploadToGoogleJob,
  WorkerMessage,
} from '@jetstream/types';
import type { Record } from 'jsforce';
import isString from 'lodash/isString';
import { axiosElectronAdapter, initMessageHandler } from '../components/core/electron-axios-adapter';

declare const self: DedicatedWorkerGlobalScope;
logger.log('[JOBS WORKER] INITIALIZED');

// Updated if a job is attempted to be cancelled, the job will check this on each iteration and cancel if possible
const cancelledJobIds = new Set<string>();

self.addEventListener('error', (event) => {
  console.log('WORKER ERROR', event);
});

// Respond to message from parent thread
self.addEventListener('message', (event) => {
  const payload: WorkerMessage<AsyncJobType, AsyncJobWorkerMessagePayload> = event.data;
  logger.info({ payload });
  handleMessage(payload.name, payload.data, event.ports?.[0]);
});

async function handleMessage(name: AsyncJobType, payloadData: AsyncJobWorkerMessagePayload, port?: MessagePort) {
  const { org, job } = payloadData || {};
  switch (name) {
    case 'isElectron': {
      initForElectron(axiosElectronAdapter);
      initMessageHandler(port);
      break;
    }
    case 'CancelJob': {
      const { job } = payloadData as AsyncJobWorkerMessagePayload<CancelJob>;
      cancelledJobIds.add(job.id);
      break;
    }
    case 'BulkDelete': {
      try {
        // TODO: add validation to ensure that we have at least one record
        // also, we are assuming that all records are same SObject
        const MAX_DELETE_RECORDS = 200;
        let records: Record | Record[] = job.meta; // TODO: add strong type
        records = Array.isArray(records) ? records : [records];
        const sobject = getSObjectFromRecordUrl(records[0].attributes.url);
        const allIds: string[] = records.map((record) => getIdFromRecordUrl(record.attributes.url));

        const results: any[] = [];
        for (const ids of splitArrayToMaxSize(allIds, MAX_DELETE_RECORDS)) {
          try {
            // TODO: add progress notification and allow cancellation
            let tempResults = await sobjectOperation(org, sobject, 'delete', { ids }, { allOrNone: false });
            tempResults = Array.isArray(tempResults) ? tempResults : [tempResults];
            tempResults.forEach((result) => results.push(result));
          } catch (ex) {
            logger.error('There was a problem deleting these records');
          }
        }

        const response: AsyncJobWorkerMessageResponse = { job, results };
        replyToMessage(name, response);
      } catch (ex) {
        const response: AsyncJobWorkerMessageResponse = { job };
        replyToMessage(name, response, ex.message);
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
            replyToMessage(name, response);

            const { queryResults } = await queryMore(org, nextRecordsUrl, isTooling).then(replaceSubqueryQueryResultsWithRecords);
            done = queryResults.done;
            nextRecordsUrl = queryResults.nextRecordsUrl;
            downloadedRecords = downloadedRecords.concat(queryResults.records);
            if (cancelledJobIds.has(job.id)) {
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
          replyToMessage(name, response, undefined);

          const finalResults = await pollBulkApiJobUntilDone(org, jobInfo, 1, {
            onChecked: () => {
              const response: AsyncJobWorkerMessageResponse = { job, lastActivityUpdate: true };
              replyToMessage(name, response, undefined);
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
          replyToMessage(name, { job, results });
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
        replyToMessage(name, response);
      } catch (ex) {
        const response: AsyncJobWorkerMessageResponse = { job };
        replyToMessage(name, response, ex.message);
      }
      break;
    }
    case 'UploadToGoogle': {
      // Message is passed through to jobs.tsx for upload
      try {
        const { job } = payloadData as AsyncJobWorkerMessagePayload<UploadToGoogleJob>;
        const response: AsyncJobWorkerMessageResponse = { job, results: job.meta };
        replyToMessage(name, response);
      } catch (ex) {
        const response: AsyncJobWorkerMessageResponse = { job };
        replyToMessage(name, response, ex.message);
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
            replyToMessage(name, response, 'An invalid metadata type was provided');
            return;
          }
        }

        if (cancelledJobIds.has(job.id)) {
          throw new Error('Job cancelled');
        }

        const results = await pollRetrieveMetadataResultsUntilDone(org, id, {
          isCancelled: () => {
            return cancelledJobIds.has(job.id);
          },
          onChecked: () => {
            const response: AsyncJobWorkerMessageResponse = { job, lastActivityUpdate: true };
            replyToMessage(name, response, undefined);
          },
        });

        if (isString(results.zipFile)) {
          const fileData = base64ToArrayBuffer(results.zipFile);
          const response: AsyncJobWorkerMessageResponse = {
            job,
            results: { fileData, mimeType, fileName, fileFormat, uploadToGoogle, googleFolder },
          };
          replyToMessage(name, response, undefined, fileData);
        } else {
          const response: AsyncJobWorkerMessageResponse = { job };
          replyToMessage(name, response, 'No file was provided from Salesforce');
        }
      } catch (ex) {
        const response: AsyncJobWorkerMessageResponse = { job };
        replyToMessage(name, response, ex.message);
        if (cancelledJobIds.has(job.id)) {
          cancelledJobIds.delete(job.id);
        }
      }
      break;
    }
    default:
      break;
  }
}

function replyToMessage(name: string, data: any, error?: any, transferrable?: any) {
  transferrable = transferrable ? [transferrable] : undefined;
  self.postMessage({ name, data, error }, transferrable);
}
