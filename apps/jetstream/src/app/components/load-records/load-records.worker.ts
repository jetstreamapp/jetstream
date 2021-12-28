/// <reference lib="webworker" />
/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from '@jetstream/shared/client-logger';
import {
  bulkApiAddBatchToJob,
  bulkApiAddBatchToJobWithAttachment,
  bulkApiCloseJob,
  bulkApiCreateJob,
  bulkApiGetJob,
  genericRequest,
} from '@jetstream/shared/data';
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
import JSZip from 'jszip';
import isString from 'lodash/isString';
import {
  LoadDataBulkApi,
  LoadDataBulkApiStatusPayload,
  LoadDataPayload,
  PrepareDataPayload,
} from '../../components/load-records/load-records-types';
import { fetchMappedRelatedRecords, transformData } from '../../components/load-records/utils/load-records-utils';

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

        // TODO: I am here, I need to add csv to zip and rename to request.txt after data transform
        // also need to change file to add `#` at the beginning each data point
        const preparedData = await fetchMappedRelatedRecords(transformData(payloadData), payloadData);

        replyToMessage(name, { preparedData });
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

async function loadBulkApiData({
  org,
  data,
  zipData,
  sObject,
  type,
  batchSize,
  externalId,
  assignmentRuleId,
  serialMode,
}: LoadDataPayload) {
  const replyName = 'loadData';
  try {
    const results = await bulkApiCreateJob(org, { type, sObject, serialMode, assignmentRuleId, externalId, hasZipAttachment: !!zipData });
    const jobId = results.id;
    let batches: LoadDataBulkApi[] = [];
    if (zipData) {
      const csv = generateCsv(data);
      const zip = await JSZip.loadAsync(zipData);
      zip.file('request.txt', csv);
      batches = [{ data: await zip.generateAsync({ type: 'arraybuffer' }), batchNumber: 0, completed: false, success: false }];
    } else {
      batches = splitArrayToMaxSize(data, batchSize)
        .map((batch) => generateCsv(batch))
        .map((data, i) => ({ data, batchNumber: i, completed: false, success: false }));
    }

    replyToMessage('loadDataStatus', { resultsSummary: getBatchSummary(results, batches) });
    let currItem = 1;
    let fatalError = false;
    for (const batch of batches) {
      try {
        const batchResult = await (zipData
          ? bulkApiAddBatchToJobWithAttachment(org, jobId, batch.data)
          : bulkApiAddBatchToJob(org, jobId, batch.data, currItem === batches.length));
        batchResult.createdDate = convertDateToLocale(batchResult.createdDate, { timeStyle: 'medium' });
        batchResult.systemModstamp = convertDateToLocale(batchResult.systemModstamp, { timeStyle: 'medium' });
        results.batches = results.batches || [];
        results.batches.push(batchResult);
        batch.id = batchResult.id;
        batch.completed = true;
        batch.success = true;
      } catch (ex) {
        batch.completed = true;
        batch.success = false;
      } finally {
        let transfer: Transferable[];
        if (batch.data instanceof ArrayBuffer) {
          transfer = [batch.data];
        }
        replyToMessage('loadDataStatus', { resultsSummary: getBatchSummary(results, batches) }, null, transfer);
      }
      currItem++;
    }
    const jobInfoWithBatches = await bulkApiGetJob(org, jobId);

    jobInfoWithBatches.batches.forEach((batch) => {
      batch.createdDate = convertDateToLocale(batch.createdDate, { timeStyle: 'medium' });
      batch.systemModstamp = convertDateToLocale(batch.systemModstamp, { timeStyle: 'medium' });
    });

    if (jobInfoWithBatches.batches.length !== batches.length) {
      // we know that at least one batch failed!
      fatalError = true;
    }

    replyToMessage(replyName, { jobInfo: jobInfoWithBatches }, (fatalError && 'One or more batches failed to load.') || null);

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

async function loadBatchApiData({ org, data, sObject, type, batchSize, externalId, assignmentRuleId }: LoadDataPayload) {
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
      let queryParams = '';
      /** if deleting records, and some records are null for the id, then those records are not loaded and the response will have incorrect indexes */
      let records = batch.records;
      let recordIndexesWithMissingIds: Set<number> = new Set();

      if (type === 'DELETE') {
        queryParams = `?ids=${batch.records
          .map((record) => record.Id)
          .filter(Boolean)
          .join(',')}&allOrNone=false`;
        /** Account for records with no mapped id - these records cannot be submitted with the batch API */
        recordIndexesWithMissingIds = new Set(
          batch.records.map((record, i) => (!record.Id ? i : undefined)).filter((idx) => Number.isFinite(idx))
        );
        records = records.filter((record) => record.Id);
      }

      try {
        // https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/headers_autoassign.htm
        // default is true
        const autoAssignHeader = { 'Sforce-Auto-Assign': assignmentRuleId || 'FALSE' };

        const response = await genericRequest<SobjectCollectionResponse>(org, {
          method,
          url: `${url}${queryParams}`,
          body: batch,
          isTooling: false,
          headers: {
            ...autoAssignHeader,
          },
        });
        responseWithRecord = response.reduce((output: RecordResultWithRecord[], response, i) => {
          // If record was skipped, add it to the list
          if (recordIndexesWithMissingIds.has(i)) {
            // remove so that we can determine if any records are remaining after processing results
            recordIndexesWithMissingIds.delete(i);
            output.push({
              success: false,
              errors: [{ fields: [], message: `This record did not have a mapped value for the Id`, statusCode: 'MISSING_ID' }],
              record: batch.records[i],
            });
          }
          output.push({ ...response, record: records[i] });
          return output;
        }, []);

        // Ensure that any remaining skipped records are accounted for
        if (recordIndexesWithMissingIds.size) {
          Array.from(recordIndexesWithMissingIds).forEach((i) => {
            responseWithRecord.push({
              success: false,
              errors: [{ fields: [], message: `This record did not have a mapped value for the Id`, statusCode: 'MISSING_ID' }],
              record: batch.records[i],
            });
          });
        }
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

function replyToMessage(name: string, data: any, error?: any, transfer?: Transferable[]) {
  ctx.postMessage({ name, data, error }, transfer);
}

export default null as any;
