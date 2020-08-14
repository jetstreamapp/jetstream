/// <reference lib="webworker" />
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  BulkDownloadJob,
  AsyncJobType,
  WorkerMessage,
  AsyncJobWorkerMessageResponse,
  AsyncJobWorkerMessagePayload,
} from '@jetstream/types';
import { logger } from '@jetstream/shared/client-logger';
import { Record } from 'jsforce';
import { sobjectOperation, queryMore } from '@jetstream/shared/data';
import {
  getSObjectFromRecordUrl,
  getIdFromRecordUrl,
  flattenRecords,
  replaceSubqueryQueryResultsWithRecords,
} from '@jetstream/shared/utils';
import { unparse } from 'papaparse';
import { prepareExcelFile, prepareCsvFile } from '../../../../../libs/shared/ui-utils/src';
import { MIME_TYPES } from '../../../../../libs/shared/constants/src';

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
        let records: Record | Record[] = job.meta; // TODO: add strong type
        records = Array.isArray(records) ? records : [records];
        const sobject = getSObjectFromRecordUrl(records[0].attributes.url);
        const ids = records.map((record) => getIdFromRecordUrl(record.attributes.url));
        let results = await sobjectOperation(org, sobject, 'delete', { ids });
        results = Array.isArray(results) ? results : [results];
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
        const { fields, records, fileFormat, fileName } = job.meta;
        let { nextRecordsUrl } = job.meta;
        let downloadedRecords = flattenRecords(records, fields);
        let done = false;

        while (!done) {
          const { queryResults } = await queryMore(org, nextRecordsUrl).then(replaceSubqueryQueryResultsWithRecords);
          done = queryResults.done;
          nextRecordsUrl = queryResults.nextRecordsUrl;
          downloadedRecords = downloadedRecords.concat(flattenRecords(queryResults.records, fields));
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
    default:
      break;
  }
}

function replyToMessage(name: string, data: any, error?: any, transferrable?: any) {
  transferrable = transferrable ? [transferrable] : undefined;
  ctx.postMessage({ name, data, error }, transferrable);
}

export default null as any;
