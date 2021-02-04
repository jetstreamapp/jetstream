/// <reference lib="webworker" />
/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from '@jetstream/shared/client-logger';
import { MIME_TYPES } from '@jetstream/shared/constants';
import {
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
  RetrieveResult,
  WorkerMessage,
} from '@jetstream/types';
import queue from 'async/queue';
import { Record } from 'jsforce';
import isString from 'lodash/isString';

// eslint-disable-next-line no-restricted-globals
const ctx: Worker = self as any;

// Respond to message from parent thread
ctx.addEventListener('message', (event) => {
  const payload: WorkerMessage<AsyncJobType, AsyncJobWorkerMessagePayload> = event.data;
  logger.info('[WORKER]', { payload });
  handleMessage(payload.name, payload.data);
});

async function handleMessage(name: AsyncJobType, payloadData: AsyncJobWorkerMessagePayload) {
  const { org, job } = payloadData;
  switch (name) {
    case 'BulkDelete': {
      try {
        // TODO: add validation to ensure that we have at least one record
        // also, we are assuming that all records are same SObject
        const MAX_DELETE_RECORDS = 200;
        const CONCURRENCY = 1;
        let records: Record | Record[] = job.meta; // TODO: add strong type
        records = Array.isArray(records) ? records : [records];
        const sobject = getSObjectFromRecordUrl(records[0].attributes.url);
        const allIds: string[] = records.map((record) => getIdFromRecordUrl(record.attributes.url));

        const results: any[] = [];
        const q = queue(async function ({ ids, results }: { ids: string[]; results: any[] }, callback) {
          const tempResults = await sobjectOperation(org, sobject, 'delete', { ids });
          (Array.isArray(tempResults) ? tempResults : [tempResults]).forEach((result) => results.push(result));
          callback();
        }, CONCURRENCY);

        q.push(splitArrayToMaxSize(allIds, MAX_DELETE_RECORDS).map((ids) => ({ ids, results })));

        q.error((err, task) => {
          logger.error('There was an error processing this task', { err, task });
        });

        await q.drain();

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
        const { isTooling, fields, records, fileFormat, fileName } = job.meta;
        let { nextRecordsUrl } = job.meta;
        let downloadedRecords = fileFormat === 'json' ? records : flattenRecords(records, fields);
        let done = false;

        while (!done) {
          const { queryResults } = await queryMore(org, nextRecordsUrl, isTooling).then(replaceSubqueryQueryResultsWithRecords);
          done = queryResults.done;
          nextRecordsUrl = queryResults.nextRecordsUrl;
          downloadedRecords =
            fileFormat === 'json'
              ? downloadedRecords.concat(queryResults.records)
              : downloadedRecords.concat(flattenRecords(queryResults.records, fields));
        }

        const data = flattenRecords(downloadedRecords, fields);
        let mimeType: string;
        let fileData;

        switch (fileFormat) {
          case 'xlsx': {
            fileData = prepareExcelFile(data, fields);
            mimeType = MIME_TYPES.XLSX;
            break;
          }
          case 'csv': {
            fileData = prepareCsvFile(data, fields);
            mimeType = MIME_TYPES.CSV;
            break;
          }
          case 'json': {
            fileData = JSON.stringify(downloadedRecords, null, 2);
            mimeType = MIME_TYPES.JSON;
            break;
          }
          default:
            throw new Error('A valid file type type has not been selected');
        }
        const results = { fileData, mimeType, fileName };

        const response: AsyncJobWorkerMessageResponse = { job, results };
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
        const { fileName, mimeType } = job.meta;

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
          const response: AsyncJobWorkerMessageResponse = { job, results: { fileData, mimeType, fileName } };
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
