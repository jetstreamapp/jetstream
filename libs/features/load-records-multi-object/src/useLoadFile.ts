import { logger } from '@jetstream/shared/client-logger';
import { genericRequest } from '@jetstream/shared/data';
import { useBrowserNotifications } from '@jetstream/shared/ui-utils';
import { getErrorMessage, getSuccessOrFailureChar, pluralizeFromNumber } from '@jetstream/shared/utils';
import { CompositeGraphResponse, CompositeGraphResponseBody, SalesforceOrgUi } from '@jetstream/types';
import { buildDataHistoryInputSource, DataHistoryEntryHandle, startDataHistoryEntry } from '@jetstream/ui/data-history';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useCallback, useEffect, useRef } from 'react';
import { finalizeMultiObjectHistory, getMultiObjectDistinctSobjects, getMultiObjectOperations } from './data-history-capture';
import { LoadMultiObjectRequestWithResult, LoadMultiObjectRun } from './load-records-multi-object-types';
import { getRecordCount } from './load-records-multi-object-utils';
import {
  dateFormatState,
  groupsByRefIdState,
  inputFilenameState,
  inputFileTypeState,
  inputGoogleFileIdState,
  insertNullsState,
  loadIsRunningState,
  loadProgressState,
  loadRunsState,
  skipDataHistoryState,
} from './load-records-multi-object.state';
import { buildRecordResultRows, buildRequestExport } from './load/load-results-utils';
import { getGroupNumbersByGraphId } from './review/review-utils';

/** Merge Salesforce composite graph responses into a fresh copy of the request (no shared-state mutation) */
function applyResultsToRequest(
  request: LoadMultiObjectRequestWithResult,
  results: CompositeGraphResponse[],
): LoadMultiObjectRequestWithResult {
  const dataWithResultsByGraphId = { ...request.dataWithResultsByGraphId };
  const recordWithResponseByRefId = { ...request.recordWithResponseByRefId };

  results.forEach((result) => {
    // in some random cases the response body is an array, but in all or most other cases it is an object
    const compositeResponse = result.graphResponse.compositeResponse.map((response) => ({
      ...response,
      body: Array.isArray(response.body) ? response.body[0] : response.body,
    }));

    dataWithResultsByGraphId[result.graphId] = {
      ...dataWithResultsByGraphId[result.graphId],
      isSuccess: result.isSuccessful,
      compositeResponse,
    };

    compositeResponse.forEach((recordResponse) => {
      recordWithResponseByRefId[recordResponse.referenceId] = {
        ...recordWithResponseByRefId[recordResponse.referenceId],
        response: recordResponse,
      };
    });
  });

  return { ...request, finished: new Date(), loading: false, results, dataWithResultsByGraphId, recordWithResponseByRefId };
}

function getNotification(requests: LoadMultiObjectRequestWithResult[]) {
  const { success, failure } = requests.reduce(
    (output, item) => {
      if (item.errorMessage) {
        output.failure += item.data.reduce((count, graph) => count + (graph.compositeRequest?.length || 0), 0);
      } else {
        item.results?.forEach((result) => {
          if (result.isSuccessful) {
            output.success += result.graphResponse.compositeResponse.length;
          } else {
            output.failure += result.graphResponse.compositeResponse.length;
          }
        });
      }
      return output;
    },
    { success: 0, failure: 0 },
  );

  return `${getSuccessOrFailureChar('success', success)} ${success.toLocaleString()} ${pluralizeFromNumber(
    'record',
    success,
  )} loaded successfully ${getSuccessOrFailureChar('failure', failure)} ${failure.toLocaleString()} ${pluralizeFromNumber(
    'record',
    failure,
  )} failed`;
}

/**
 * Executes composite graph requests sequentially, tracked as a list of runs (initial load + retries).
 * Supports cancellation between requests - a request already sent to Salesforce cannot be aborted
 * because each graph is an atomic transaction on the server.
 */
export const useLoadFile = (org: SalesforceOrgUi, serverUrl: string, apiVersion: string) => {
  const { notifyUser } = useBrowserNotifications(serverUrl);
  const [runs, setRuns] = useAtom(loadRunsState);
  const [loading, setLoading] = useAtom(loadIsRunningState);
  const setProgress = useSetAtom(loadProgressState);

  const inputFilename = useAtomValue(inputFilenameState);
  const inputFileType = useAtomValue(inputFileTypeState);
  const inputGoogleFileId = useAtomValue(inputGoogleFileIdState);
  const insertNulls = useAtomValue(insertNullsState);
  const dateFormat = useAtomValue(dateFormatState);
  const groupsByRefId = useAtomValue(groupsByRefIdState);
  const skipDataHistory = useAtomValue(skipDataHistoryState);

  const isMounted = useRef(true);
  const cancelRequestedRef = useRef(false);
  /** Handle for the initial run's history entry — retry runs are recorded as its children */
  const initialHistoryHandleRef = useRef<DataHistoryEntryHandle | null>(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Start Over clears the runs — drop the parent handle with them so a later retry can never be
  // filed under a previous file's history entry
  useEffect(() => {
    if (!runs.length) {
      initialHistoryHandleRef.current = null;
    }
  }, [runs.length]);

  const updateRunRequest = useCallback(
    (runId: number, key: string, applyUpdate: (request: LoadMultiObjectRequestWithResult) => LoadMultiObjectRequestWithResult) => {
      setRuns((priorRuns) =>
        priorRuns.map((run) =>
          run.runId === runId
            ? { ...run, requests: run.requests.map((request) => (request.key === key ? applyUpdate(request) : request)) }
            : run,
        ),
      );
    },
    [setRuns],
  );

  /**
   * Begin a Data History entry for a run (self-gates, fire-and-forget). One entry covers the whole
   * multi-object run — `sobjects` spans every object and `operation` is the shared op ('insert' when
   * mixed, with the per-object operations recorded in `config`). Retry runs hang off the initial run.
   */
  const startHistoryCapture = useCallback(
    (requests: LoadMultiObjectRequestWithResult[], type: LoadMultiObjectRun['type']): DataHistoryEntryHandle => {
      const operations = getMultiObjectOperations(requests);
      const historyHandle = startDataHistoryEntry({
        org,
        source: 'load-multi-object',
        operation: operations.operation,
        api: 'composite-graph',
        sobjects: getMultiObjectDistinctSobjects(requests),
        config: {
          insertNulls,
          dateFormat,
          isRetry: type === 'retry',
          numRequests: requests.length,
          numGroups: requests.reduce((count, request) => count + Object.keys(request.dataWithResultsByGraphId).length, 0),
          operationsByObject: operations.byObject,
          mixedOperations: operations.mixed,
        },
        inputSource: buildDataHistoryInputSource({
          filename: inputFilename,
          filenameType: inputFileType,
          googleFileId: inputGoogleFileId,
        }),
        parentKey: type === 'retry' ? initialHistoryHandleRef.current?.key : undefined,
        skipHistory: skipDataHistory,
      });

      if (type === 'initial') {
        initialHistoryHandleRef.current = historyHandle;
      }
      historyHandle.writeRequestJson(buildRequestExport(requests));
      return historyHandle;
    },
    [dateFormat, inputFileType, inputFilename, inputGoogleFileId, insertNulls, org, skipDataHistory],
  );

  const executeRun = useCallback(
    async (requestsToProcess: LoadMultiObjectRequestWithResult[], type: LoadMultiObjectRun['type']) => {
      cancelRequestedRef.current = false;
      // Deep clone so re-loads and retries never share result state with the pristine graph output
      const requests: LoadMultiObjectRequestWithResult[] = JSON.parse(JSON.stringify(requestsToProcess));
      const historyHandle = startHistoryCapture(requests, type);
      let runId = 0;
      setRuns((priorRuns) => {
        runId = priorRuns.length;
        return [...priorRuns, { runId, type, requests, startedAt: new Date(), finishedAt: null, cancelled: false }];
      });
      setLoading(true);

      const recordsTotal = getRecordCount(requests);
      let recordsProcessed = 0;
      let cancelled = false;
      setProgress({ current: 0, total: requests.length, recordsProcessed, recordsTotal });

      for (let requestIdx = 0; requestIdx < requests.length; requestIdx++) {
        const currentRequest = requests[requestIdx];
        if (cancelRequestedRef.current) {
          cancelled = true;
          break;
        }
        setProgress({ current: requestIdx + 1, total: requests.length, recordsProcessed, recordsTotal });
        updateRunRequest(runId, currentRequest.key, (request) => ({ ...request, loading: true, started: new Date() }));
        try {
          const response = await genericRequest<CompositeGraphResponseBody>(org, {
            method: 'POST',
            url: `/services/data/${apiVersion}/composite/graph`,
            body: { graphs: currentRequest.data },
            isTooling: false,
          });
          logger.info('[LOAD MULTI OBJ] Request finished', { response });
          if (isMounted.current) {
            updateRunRequest(runId, currentRequest.key, (request) => applyResultsToRequest(request, response.graphs));
          }
        } catch (ex) {
          logger.error('[LOAD MULTI OBJ] Exception', ex);
          if (isMounted.current) {
            updateRunRequest(runId, currentRequest.key, (request) => ({
              ...request,
              finished: new Date(),
              loading: false,
              errorMessage: getErrorMessage(ex),
            }));
          }
        }
        recordsProcessed += getRecordCount([currentRequest]);
        if (isMounted.current) {
          setProgress({ current: requestIdx + 1, total: requests.length, recordsProcessed, recordsTotal });
        }
      }

      if (isMounted.current) {
        setLoading(false);
        const finishedAt = new Date();
        let finishedRequests: LoadMultiObjectRequestWithResult[] = [];
        setRuns((priorRuns) =>
          priorRuns.map((run) => {
            if (run.runId !== runId) {
              return run;
            }
            finishedRequests = run.requests;
            return { ...run, finishedAt, cancelled };
          }),
        );
        notifyUser(cancelled ? `Your data load was cancelled` : `Your data load is finished`, {
          body: getNotification(finishedRequests),
          tag: 'load-multi-object',
        });
        void finalizeMultiObjectHistory(historyHandle, {
          rows: buildRecordResultRows(
            [{ runId, type, requests: finishedRequests, startedAt: null, finishedAt, cancelled }],
            getGroupNumbersByGraphId(groupsByRefId),
          ),
          requests: finishedRequests,
        });
      }
    },
    [org, apiVersion, groupsByRefId, notifyUser, setLoading, setProgress, setRuns, startHistoryCapture, updateRunRequest],
  );

  const loadFile = useCallback((requests: LoadMultiObjectRequestWithResult[]) => executeRun(requests, 'initial'), [executeRun]);

  const retryFailed = useCallback((requests: LoadMultiObjectRequestWithResult[]) => executeRun(requests, 'retry'), [executeRun]);

  const cancel = useCallback(() => {
    cancelRequestedRef.current = true;
  }, []);

  return { loadFile, retryFailed, cancel, loading, runs };
};

export default useLoadFile;
