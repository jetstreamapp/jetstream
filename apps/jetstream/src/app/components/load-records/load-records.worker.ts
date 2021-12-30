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
import { getHttpMethod, getSizeInMbFromBase64, splitArrayToMaxSize } from '@jetstream/shared/utils';
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

async function loadBulkApiData({ org, data, sObject, type, batchSize, externalId, assignmentRuleId, serialMode }: LoadDataPayload) {
  const replyName = 'loadData';
  try {
    const results = await bulkApiCreateJob(org, { type, sObject, serialMode, assignmentRuleId, externalId });
    const jobId = results.id;
    let batches: LoadDataBulkApi[] = [];
    batches = splitArrayToMaxSize(data, batchSize)
      .map((batch) => generateCsv(batch))
      .map((data, i) => ({ data, batchNumber: i, completed: false, success: false }));

    replyToMessage('loadDataStatus', { resultsSummary: getBatchSummary(results, batches) });
    let currItem = 1;
    let fatalError = false;
    for (const batch of batches) {
      try {
        const batchResult = await bulkApiAddBatchToJob(org, jobId, batch.data, currItem === batches.length);
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

async function loadBatchApiData(payload: LoadDataPayload) {
  const { org, sObject, type, externalId, assignmentRuleId } = payload;
  const replyName = 'loadData';
  try {
    const { batchRecordMap, batches, failedRecords } = await getBatchApiBatches(payload);

    let url = `/composite/sobjects`;
    if (type === 'UPSERT' && externalId) {
      url += `/${sObject}/${externalId}`;
    }
    const method: HttpMethod = getHttpMethod(type);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      let responseWithRecord: RecordResultWithRecord[];
      let queryParams = '';
      /** if deleting records, and some records are null for the id, then those records are not loaded and the response will have incorrect indexes */
      let records = batch.records;
      /** This stores the original record before adding {attribute} tag and before adding base64 zip */
      const originalBatchRecords = batchRecordMap.get(batchIndex);
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
              record: originalBatchRecords[i],
            });
          }
          output.push({ ...response, record: originalBatchRecords[i] });
          return output;
        }, []);

        // Ensure that any remaining skipped records are accounted for
        if (recordIndexesWithMissingIds.size) {
          Array.from(recordIndexesWithMissingIds).forEach((i) => {
            responseWithRecord.push({
              success: false,
              errors: [{ fields: [], message: `This record did not have a mapped value for the Id`, statusCode: 'MISSING_ID' }],
              record: originalBatchRecords[i],
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
            record: originalBatchRecords[i],
          })
        );
      } finally {
        replyToMessage('loadDataStatus', { records: responseWithRecord });
      }
    }
    // Handle and processing failures (these happen when processing binary data)
    if (failedRecords.length) {
      replyToMessage('loadDataStatus', {
        records: failedRecords.map(
          (record): RecordResultWithRecord => ({
            success: false,
            errors: [
              {
                fields: [],
                message: `An unknown error has occurred while processing this record.`,
                statusCode: 'UNKNOWN',
              },
            ],
            record,
          })
        ),
      });
    }
    replyToMessage(replyName, {});
  } catch (ex) {
    return replyToMessage(replyName, null, ex);
  }
}

/**
 * Handles preparing batches for the Batch API
 * If required, prepares zip attachments as base64 and calculates the batch size
 *
 * @param {LoadDataPayload} payload
 * @returns
 */
async function getBatchApiBatches({
  data,
  sObject,
  batchSize,
  zipData,
  binaryBodyField,
}: LoadDataPayload): Promise<{ batches: SobjectCollectionRequest[]; batchRecordMap: Map<number, any[]>; failedRecords: any[] }> {
  let batches: SobjectCollectionRequest[] = [];
  // used to ensure we don't send base64 (huge) back to browser
  const batchRecordMap: Map<number, any[]> = new Map();
  const failedRecords: any[] = [];

  /** Batch size is auto-detected when there are attachments to ensure that the load is not too large */
  if (zipData && binaryBodyField) {
    // Get file from zip and convert to base64
    const zip = await JSZip.loadAsync(zipData);
    const THRESHOLD_SIZE_MB = 5;
    const THRESHOLD_RECORDS = 200;
    let i = 0;
    let currentSize = 0;
    let request: SobjectCollectionRequest = {
      allOrNone: false,
      records: [],
    };
    // auto-detect batch size based on size of attachments
    for (const _record of data) {
      try {
        const record: SobjectCollectionRequestRecord = { attributes: { type: sObject }, ..._record };
        if (_record[binaryBodyField]) {
          const foundFile = zip.file(record[binaryBodyField]);
          if (foundFile) {
            record[binaryBodyField] = await foundFile.async('base64');
            currentSize += getSizeInMbFromBase64(record[binaryBodyField]);
          } else {
            record[binaryBodyField] = null;
          }
        }
        request.records.push(record);
        if (!Array.isArray(batchRecordMap.get(i))) {
          batchRecordMap.set(i, []);
        }
        batchRecordMap.get(i).push(_record);
      } catch (ex) {
        failedRecords.push(_record);
      }

      if (currentSize >= THRESHOLD_SIZE_MB || request.records.length >= THRESHOLD_RECORDS) {
        batches.push(request);
        request = {
          allOrNone: false,
          records: [],
        };
        i++;
        currentSize = 0;
      }
    }
    // make sure to pick up final batch
    if (request.records.length) {
      batches.push(request);
    }
  } else {
    batches = splitArrayToMaxSize(data, batchSize).map((records, i): SobjectCollectionRequest => {
      batchRecordMap.set(i, records);
      return {
        allOrNone: false,
        records: records.map((record): SobjectCollectionRequestRecord => ({ attributes: { type: sObject }, ...record })),
      };
    });
  }
  return { batches, batchRecordMap, failedRecords };
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
