/// <reference lib="webworker" />
/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from '@jetstream/shared/client-logger';
import { MIME_TYPES } from '@jetstream/shared/constants';
import {
  initForElectron,
  queryMore,
  retrieveMetadataFromListMetadata,
  retrieveMetadataFromManifestFile,
  retrieveMetadataFromPackagesNames,
  sobjectOperation,
} from '@jetstream/shared/data';
import { base64ToArrayBuffer, pollRetrieveMetadataResultsUntilDone, prepareCsvFile, prepareExcelFile } from '@jetstream/shared/ui-utils';
import {
  flattenRecords,
  getIdFromRecordUrl,
  getMapOfBaseAndSubqueryRecords,
  getSObjectFromRecordUrl,
  replaceSubqueryQueryResultsWithRecords,
  splitArrayToMaxSize,
} from '@jetstream/shared/utils';
import {
  AsyncJobType,
  AsyncJobWorkerMessagePayload,
  AsyncJobWorkerMessageResponse,
  BulkDownloadJob,
  RetrievePackageFromListMetadataJob,
  RetrievePackageFromManifestJob,
  RetrievePackageFromPackageNamesJob,
  UploadToGoogleJob,
  WorkerMessage,
} from '@jetstream/types';
import { Record } from 'jsforce';
import isString from 'lodash/isString';
import { axiosElectronAdapter, initMessageHandler } from '../components/core/electron-axios-adapter';

// eslint-disable-next-line no-restricted-globals
const ctx: Worker = self as any;

// Respond to message from parent thread
ctx.addEventListener('message', (event) => {
  const payload: WorkerMessage<AsyncJobType, AsyncJobWorkerMessagePayload> = event.data;
  logger.info('[WORKER]', { payload });
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
        const { isTooling, fields, records, fileFormat, fileName, subqueryFields, includeSubquery, googleFolder } = job.meta;
        // eslint-disable-next-line prefer-const
        let { nextRecordsUrl, totalRecordCount } = job.meta;
        let downloadedRecords = records;
        let done = !nextRecordsUrl;

        while (!done) {
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
        }

        let mimeType: string;
        let fileData;

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

        const results = await pollRetrieveMetadataResultsUntilDone(org, id, {
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
      }
      break;
    }
    default:
      break;
  }
}

function replyToMessage(name: string, data: any, error?: any, transferrable?: any) {
  transferrable = transferrable ? [transferrable] : undefined;
  ctx.postMessage({ name, data, error }, transferrable);
}

export default null as any;
