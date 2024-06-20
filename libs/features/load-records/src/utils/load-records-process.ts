import { logger } from '@jetstream/shared/client-logger';
import { bulkApiAddBatchToJob, bulkApiCloseJob, bulkApiCreateJob, bulkApiGetJob, genericRequest } from '@jetstream/shared/data';
import { generateCsv } from '@jetstream/shared/ui-utils';
import { getErrorMessage, getHttpMethod, getSizeInMbFromBase64, splitArrayToMaxSize } from '@jetstream/shared/utils';
import {
  BulkJobBatchInfo,
  BulkJobWithBatches,
  HttpMethod,
  LoadDataBulkApi,
  LoadDataBulkApiStatusPayload,
  LoadDataPayload,
  PrepareDataPayload,
  RecordResultWithRecord,
  SobjectCollectionRequest,
  SobjectCollectionRequestRecord,
  SobjectCollectionResponse,
} from '@jetstream/types';
import { LoadRecordsBatchError, fetchMappedRelatedRecords, transformData } from '@jetstream/ui-core';
import JSZip from 'jszip';
import isString from 'lodash/isString';

/**
 * Pre-process all load data to prepare for loading
 *
 * @param payloadData
 * @param progressCallback
 * @returns
 */
export async function prepareData(payloadData: PrepareDataPayload, progressCallback: (progress: number) => void) {
  const { data, fieldMapping, sObject, dateFormat, apiMode } = payloadData;

  if (!Array.isArray(data) || !fieldMapping || !isString(sObject) || !isString(dateFormat) || !isString(apiMode)) {
    throw new Error('The required parameters were not included in the request');
  }

  const preparedData = await fetchMappedRelatedRecords(await transformData(payloadData), payloadData, progressCallback);

  return preparedData;
}

/**
 * Load data using the BULK API
 *
 * @param param0
 * @param statusCallback
 * @returns
 */
export async function loadBulkApiData(
  { org, data, sObject, type, batchSize, externalId, assignmentRuleId, serialMode }: LoadDataPayload,
  statusCallback: (resultsSummary: LoadDataBulkApiStatusPayload) => void,
  checkIfAborted: () => boolean
) {
  try {
    const results = await bulkApiCreateJob(org, { type, sObject, serialMode, assignmentRuleId, externalId });
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const jobId = results.id!;
    let batches: LoadDataBulkApi[] = [];
    batches = splitArrayToMaxSize(data, batchSize)
      .map((batch) => generateCsv(batch, { delimiter: ',' }))
      .map((data, i) => ({ data, batchNumber: i, completed: false, success: false }));

    statusCallback(getBatchSummary(results, batches));
    let currItem = 1;
    let fatalError = false;
    const loadErrors: Error[] = [];
    const batchOrderMap: Record<string, number> = {};
    for (const batch of batches) {
      try {
        if (checkIfAborted()) {
          throw new Error('Aborted');
        }
        const batchResult = await bulkApiAddBatchToJob(org, jobId, batch.data, currItem === batches.length);
        batchOrderMap[batchResult.id] = currItem - 1;
        results.batches = results.batches || [];
        results.batches.push(batchResult);
        batch.id = batchResult.id;
        batch.completed = true;
        batch.success = true;
      } catch (ex) {
        batch.completed = true;
        batch.success = false;
        batch.errorMessage = getErrorMessage(ex);
        loadErrors.push(ex as unknown as Error);
      } finally {
        statusCallback(getBatchSummary(results, batches));
      }
      currItem++;
    }

    const jobInfoWithBatches = await bulkApiGetJob(org, jobId);

    const sortedBatches: BulkJobBatchInfo[] = [];
    jobInfoWithBatches.batches.forEach((batch) => {
      sortedBatches[batchOrderMap[batch.id]] = batch;
    });
    // just in case a batch failed and the is a gap in the array
    jobInfoWithBatches.batches = sortedBatches.filter(Boolean);

    if (jobInfoWithBatches.batches.length !== batches.length) {
      // we know that at least one batch failed!
      fatalError = true;
    }

    if (jobInfoWithBatches.state === 'Open') {
      // close job last so user does not have to wait for this since it does not matter
      bulkApiCloseJob(org, jobId).catch((ex) => {
        logger.warn('Error closing job', ex);
      });
    }

    return {
      jobInfo: jobInfoWithBatches,
      loadError: fatalError || loadErrors.length ? new LoadRecordsBatchError(`One or more batches failed to load`, loadErrors) : null,
    };
  } catch (ex) {
    logger.error('Error loading data', ex);
    throw ex;
  }
}

/**
 * Load data using the Composite API (AKA Batch API)
 *
 * @param payload
 * @param statusCallback
 */
export async function loadBatchApiData(
  payload: LoadDataPayload,
  statusCallback: (records: RecordResultWithRecord[]) => void,
  checkIfAborted: () => boolean
) {
  const { org, sObject, type, externalId, assignmentRuleId } = payload;
  try {
    const { batchRecordMap, batches, failedRecords } = await getBatchApiBatches(payload);

    let url = `/composite/sobjects`;
    if (type === 'UPSERT' && externalId) {
      url += `/${sObject}/${externalId}`;
    }
    const method: HttpMethod = getHttpMethod(type);

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
      const batch = batches[batchIndex];
      let responseWithRecord: RecordResultWithRecord[] = [];
      let queryParams = '';
      /** if deleting records, and some records are null for the id, then those records are not loaded and the response will have incorrect indexes */
      let records = batch.records;
      /** This stores the original record before adding {attribute} tag and before adding base64 zip */
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      const originalBatchRecords = batchRecordMap.get(batchIndex)!;
      let recordIndexesWithMissingIds: Set<number> = new Set();

      try {
        if (checkIfAborted()) {
          throw new Error('Aborted');
        }
        if (type === 'DELETE') {
          queryParams = `?ids=${batch.records
            ?.map((record) => record.Id)
            .filter(Boolean)
            .join(',')}&allOrNone=false`;
          /** Account for records with no mapped id - these records cannot be submitted with the batch API */
          recordIndexesWithMissingIds = new Set(
            batch.records?.map((record, i) => (!record.Id ? i : undefined)).filter((idx) => Number.isFinite(idx)) || []
          ) as Set<number>;
          records = records?.filter((record) => record.Id) || [];
        }

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
              record: originalBatchRecords?.[i] || [],
            });
          }
          output.push({ ...response, record: originalBatchRecords?.[i] });
          return output;
        }, []);

        // Ensure that any remaining skipped records are accounted for
        if (recordIndexesWithMissingIds.size) {
          Array.from(recordIndexesWithMissingIds).forEach((i) => {
            responseWithRecord.push({
              success: false,
              errors: [{ fields: [], message: `This record did not have a mapped value for the Id`, statusCode: 'MISSING_ID' }],
              record: originalBatchRecords?.[i],
            });
          });
        }
      } catch (ex) {
        let message = `An unknown error has occurred. Salesforce Message: ${getErrorMessage(ex)}`;
        let statusCode = 'UNKNOWN';
        if (checkIfAborted()) {
          message = 'Data load aborted';
          statusCode = 'ABORTED';
        }
        responseWithRecord =
          batch.records?.map(
            (record, i): RecordResultWithRecord => ({
              success: false,
              errors: [
                {
                  fields: [],
                  message,
                  statusCode,
                },
              ],
              record: originalBatchRecords[i],
            })
          ) || [];
      } finally {
        // replyToMessage('loadDataStatus', { records: responseWithRecord });
        statusCallback(responseWithRecord);
      }
    }
    // Handle and processing failures (these happen when processing binary data)
    if (failedRecords.length) {
      statusCallback(
        failedRecords.map(
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
        )
      );
    }
  } catch (ex) {
    logger.error('Error loading data', ex);
    throw ex;
  }
}

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
    let request: Required<SobjectCollectionRequest> = {
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
        batchRecordMap.get(i)?.push(_record);
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
