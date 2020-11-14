/// <reference lib="webworker" />
/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from '@jetstream/shared/client-logger';
import { bulkApiAddBatchToJob, bulkApiCloseJob, bulkApiCreateJob, bulkApiGetJob, genericRequest } from '@jetstream/shared/data';
import { convertDateToLocale, generateCsv } from '@jetstream/shared/ui-utils';
import { getHttpMethod, splitArrayToMaxSize } from '@jetstream/shared/utils';
import {
  BulkJobWithBatches,
  HttpMethod,
  RecordResultWithRecord,
  SobjectCollectionRequest,
  SobjectCollectionRequestRecord,
  SobjectCollectionResponse,
  WorkerMessage,
} from '@jetstream/types';
import isString from 'lodash/isString';
import {
  LoadDataBulkApi,
  LoadDataBulkApiStatusPayload,
  LoadDataPayload,
  PrepareDataPayload,
} from '../../components/load-records/load-records-types';
import { transformData } from '../../components/load-records/utils/load-records-utils';

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
        const { apiMode } = payloadData as LoadDataPayload;
        if (apiMode === 'BULK') {
          // BULK - emits LoadDataBulkApiStatusPayload
          loadBulkApiData(payloadData as LoadDataPayload);
        } else {
          // BATCH - emits {records: RecordResultWithRecord[]}
          loadBatchApiData(payloadData as LoadDataPayload);
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

async function loadBulkApiData({ org, data, sObject, type, batchSize, externalId, serialMode }: LoadDataPayload) {
  const replyName = 'loadData';
  try {
    const results = await bulkApiCreateJob(org, { type, sObject, serialMode, externalId });
    const jobId = results.id;
    const batches: LoadDataBulkApi[] = splitArrayToMaxSize(data, batchSize)
      .map((batch) => generateCsv(batch))
      .map((data, i) => ({ data, batchNumber: i, completed: false, success: false }));

    replyToMessage('loadDataStatus', { resultsSummary: getBatchSummary(results, batches) });
    let currItem = 1;
    for (const batch of batches) {
      try {
        const batchResult = await bulkApiAddBatchToJob(org, jobId, batch.data, currItem === batches.length);
        batchResult.createdDate = convertDateToLocale(batchResult.createdDate);
        batchResult.systemModstamp = convertDateToLocale(batchResult.systemModstamp);
        results.batches = results.batches || [];
        results.batches.push(batchResult);
        batch.id = batchResult.id;
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

    jobInfoWithBatches.batches.forEach((batch) => {
      batch.createdDate = convertDateToLocale(batch.createdDate);
      batch.systemModstamp = convertDateToLocale(batch.systemModstamp);
    });

    replyToMessage(replyName, { jobInfo: jobInfoWithBatches });

    // if final batch failed, close job manually
    if (jobInfoWithBatches.state === 'Open') {
      // close job last so user does not have to wait for this since it does not matter
      try {
        await bulkApiCloseJob(org, jobId);
      } catch (ex) {
        // ignore batch closure failures
      }
    }
  } catch (ex) {
    return replyToMessage(replyName, null, new Error(ex.message));
  }
}

async function loadBatchApiData({ org, data, sObject, type, batchSize, externalId, serialMode }: LoadDataPayload) {
  const replyName = 'loadData';
  try {
    const batches = splitArrayToMaxSize(data, batchSize).map(
      (records): SobjectCollectionRequest => ({
        allOrNone: false,
        records: records.map((record): SobjectCollectionRequestRecord => ({ attributes: { type: sObject }, ...record })),
      })
    );

    let url = `/composite/sobjects`;
    if (type === 'UPSERT' && externalId) {
      url += `/${sObject}/${externalId}`;
    }
    const method: HttpMethod = getHttpMethod(type);

    for (const batch of batches) {
      let responseWithRecord: RecordResultWithRecord[];
      try {
        const response = await genericRequest<SobjectCollectionResponse>(org, {
          method,
          url,
          body: batch,
          isTooling: false,
        });
        responseWithRecord = response.map((record, i): RecordResultWithRecord => ({ ...record, record: batch.records[i] }));
      } catch (ex) {
        responseWithRecord = batch.records.map(
          (record, i): RecordResultWithRecord => ({
            success: false,
            errors: [
              {
                fields: [],
                message: `An unknown error has occurred. Salesforce Message: ${ex.message}`,
                statusCode: 'UNKNOWN',
              },
            ],
            record: batch.records[i],
          })
        );
      } finally {
        replyToMessage('loadDataStatus', { records: responseWithRecord });
      }
    }
    replyToMessage(replyName, {});
  } catch (ex) {
    return replyToMessage(replyName, null, new Error(ex.message));
  }
}

function getBatchSummary(results: BulkJobWithBatches, batches: LoadDataBulkApi[]): LoadDataBulkApiStatusPayload {
  return {
    jobInfo: results,
    totalBatches: batches.length,
    batchSummary: batches.map(({ id, batchNumber, completed, success }) => ({ id, batchNumber, completed, success })),
  };
}

function replyToMessage(name: string, data: any, error?: any) {
  ctx.postMessage({ name, data, error });
}

export default null as any;
