/// <reference lib="webworker" />
/* eslint-disable @typescript-eslint/no-explicit-any */
import { BulkJob, WorkerMessage } from '@jetstream/types';
import { transformData } from '../components/load-records/utils/load-records-utils';
import { logger } from '@jetstream/shared/client-logger';
import { LoadDataPayload, PrepareDataPayload, LoadDataBatch, LoadDataStatusPayload } from '../components/load-records/load-records-types';
import isString from 'lodash/isString';
import { splitArrayToMaxSize } from '@jetstream/shared/utils';
import { generateCsv } from '@jetstream/shared/ui-utils';
import { bulkApiAddBatchToJob, bulkApiCloseJob, bulkApiCreateJob, bulkApiGetJob } from '@jetstream/shared/data';

type MessageName = 'prepareData' | 'loadData' | 'loadDataStatus';
// eslint-disable-next-line no-restricted-globals
const ctx: Worker = self as any;

// Respond to message from parent thread
ctx.addEventListener('message', (event) => {
  const payload: WorkerMessage<MessageName> = event.data;
  logger.info('[WORKER]', { payload });
  handleMessage(payload.name, payload.data);
});

async function handleMessage(name: MessageName, payloadData: any) {
  try {
    switch (name) {
      case 'prepareData': {
        payloadData = payloadData || {};
        const { data, fieldMapping, sObject, dateFormat, apiMode } = payloadData as PrepareDataPayload;
        if (!Array.isArray(data) || !fieldMapping || !isString(sObject) || !isString(dateFormat) || !isString(apiMode)) {
          throw new Error('The required parameters were not included in the request');
        }
        const results = transformData(payloadData);
        replyToMessage(name, { preparedData: results });
        break;
      }
      case 'loadData': {
        const { org, data, sObject, apiMode, type, batchSize, externalId, serialMode } = payloadData as LoadDataPayload;
        if (apiMode === 'BULK') {
          const results = await bulkApiCreateJob(org, { type, sObject, serialMode, externalId });
          const jobId = results.id;
          const batches: LoadDataBatch[] = splitArrayToMaxSize(data, batchSize)
            .map((batch) => generateCsv(batch))
            .map((data, i) => ({ data, batchNumber: i, completed: false, success: false }));

          replyToMessage('loadDataStatus', { resultsSummary: getBatchSummary(results, batches) });
          let currItem = 1;
          for (const batch of batches) {
            try {
              await bulkApiAddBatchToJob(org, jobId, batch.data, currItem === batches.length);
              batch.completed = true;
              batch.success = true;
            } catch (ex) {
              batch.completed = true;
              batch.success = false;
            } finally {
              replyToMessage('loadDataStatus', { resultsSummary: getBatchSummary(results, batches) });
            }
            currItem++;
          }
          const jobInfoWithBatches = await bulkApiGetJob(org, jobId);
          replyToMessage(name, { jobInfo: jobInfoWithBatches });

          // if final batch failed, close job manually
          if (jobInfoWithBatches.state === 'Open') {
            // close job last so user does not have to wait for this since it does not matter
            try {
              await bulkApiCloseJob(org, jobId);
            } catch (ex) {
              // ignore batch closure failures
            }
          }
        } else {
          // TODO:
          // BATCH
          replyToMessage(name, { ignored: true });
        }
        break;
      }
      default:
        break;
    }
  } catch (ex) {
    return replyToMessage(name, null, new Error(ex.message));
  }
}

function getBatchSummary(results: BulkJob, batches: LoadDataBatch[]): LoadDataStatusPayload {
  return {
    jobInfo: results,
    totalBatches: batches.length,
    batchSummary: batches.map(({ batchNumber, completed, success }) => ({ batchNumber, completed, success })),
  };
}

function replyToMessage(name: string, data: any, error?: any) {
  ctx.postMessage({ name, data, error });
}

export default null as any;
