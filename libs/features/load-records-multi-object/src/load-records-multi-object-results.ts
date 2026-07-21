import { DataHistoryCounts } from '@jetstream/types';
import { LoadMultiObjectRequestWithResult } from './load-records-multi-object-types';

/**
 * Shared builders for the multi-object load request/result exports. These are the single source of
 * truth for the row shapes used by BOTH the interactive download (`useDownloadResults`) and the
 * Data History capture, so the two never drift. All functions are pure over the load data model.
 */

/** Header for the flattened per-record results export */
export const MULTI_OBJECT_RESULTS_HEADER = [
  'Group',
  'Object',
  'Operation',
  'External Id',
  'Reference Id',
  'Id',
  'Success',
  'Created',
  'Error',
];

/** Raw request payload dumped for the "download request" action and captured as `request.json.gz` */
export function buildMultiObjectRequestExport(data: LoadMultiObjectRequestWithResult[]): { groupId: string; data: unknown[] }[] {
  return data.map((item) => ({ groupId: item.key, data: Object.values(item.dataWithResultsByGraphId) }));
}

/**
 * Flatten every per-record composite-graph response into a result row. `which === 'failures'` keeps
 * only unsuccessful graphs. Groups that failed before Salesforce responded (`errorMessage` set,
 * `results` null) produce no rows here — their records are counted as failures by `getMultiObjectCounts`.
 */
export function buildMultiObjectResultRows(
  data: LoadMultiObjectRequestWithResult[],
  which: 'results' | 'failures',
): Record<string, unknown>[] {
  return (
    data.flatMap(
      ({ results, recordWithResponseByRefId }) =>
        results
          ?.filter(({ isSuccessful }) => (which === 'failures' ? !isSuccessful : true))
          .flatMap(({ graphResponse, graphId }) =>
            graphResponse.compositeResponse.map((response) => {
              const { referenceId } = response;
              const { operation, sobject, externalId } = recordWithResponseByRefId[referenceId] || {};
              // PATCH returns 204 with no body
              if (!response.body) {
                response.body = {
                  id: '',
                  success: true,
                  errors: [],
                };
              }
              const { id, success, message, created, errorCode } = response.body;
              return {
                Group: graphId,
                Object: sobject,
                Operation: operation,
                'External Id': externalId,
                'Reference Id': referenceId,
                Id: id || '',
                Success: !!success,
                Created: !!created || (operation === 'INSERT' && !!success),
                Error: errorCode ? `${errorCode}: ${message}` : '',
              };
            }),
          ) || [],
    ) || []
  );
}

/**
 * Compute per-record counts from the finished load data. `success`/`failure` are counted at the
 * record (composite response) level; records belonging to a group that failed outright (its whole
 * composite-graph POST threw) are counted as failures even though they produced no response rows.
 */
export function getMultiObjectCounts(data: LoadMultiObjectRequestWithResult[]): DataHistoryCounts {
  const resultRows = buildMultiObjectResultRows(data, 'results');
  const success = resultRows.filter((row) => row.Success === true).length;
  const responseFailures = resultRows.length - success;
  const failedGroupRecords = data.reduce(
    (total, item) => (item.errorMessage ? total + Object.keys(item.recordWithResponseByRefId).length : total),
    0,
  );
  const failure = responseFailures + failedGroupRecords;
  return { total: success + failure, success, failure };
}
