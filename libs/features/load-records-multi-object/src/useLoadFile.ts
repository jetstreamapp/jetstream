import { logger } from '@jetstream/shared/client-logger';
import { genericRequest } from '@jetstream/shared/data';
import { useBrowserNotifications } from '@jetstream/shared/ui-utils';
import { getErrorMessage, getSuccessOrFailureChar, groupByFlat, pluralizeFromNumber } from '@jetstream/shared/utils';
import { CompositeGraphResponse, CompositeGraphResponseBody, SalesforceOrgUi } from '@jetstream/types';
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { LoadMultiObjectRequestWithResult } from './load-records-multi-object-types';

type Action =
  | { type: 'INIT'; payload: { loading: boolean; data: Record<string, LoadMultiObjectRequestWithResult> | null } }
  | { type: 'ITEM_STARTED'; payload: { key: string } }
  | { type: 'ITEM_FAILED'; payload: { key: string; errorMessage: string } }
  | { type: 'ITEM_FINISHED'; payload: { key: string; results: CompositeGraphResponse[] } }
  | { type: 'FINISHED' };

interface State {
  loading: boolean;
  data: Record<string, LoadMultiObjectRequestWithResult> | null;
  dataArray: LoadMultiObjectRequestWithResult[] | null;
  finished: boolean;
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'INIT':
      return {
        loading: action.payload.loading,
        data: action.payload.data,
        dataArray: action.payload.data ? Object.values(action.payload.data) : null,
        finished: false,
      };
    case 'ITEM_STARTED': {
      const { key } = action.payload;
      const data: Record<string, LoadMultiObjectRequestWithResult> = { ...state.data };
      data[key] = {
        ...data[key],
        started: new Date(),
        loading: true,
      };
      return { ...state, data, dataArray: Object.values(data) };
    }
    case 'ITEM_FAILED': {
      const { key, errorMessage } = action.payload;
      const data: Record<string, LoadMultiObjectRequestWithResult> = { ...state.data };
      data[key] = {
        ...data[key],
        finished: new Date(),
        loading: false,
        errorMessage,
      };
      logger.info('[LOAD MULTI OBJ] Failed data', { data });
      return { ...state, data, dataArray: Object.values(data) };
    }
    case 'ITEM_FINISHED': {
      const { key, results } = action.payload;
      const data: Record<string, LoadMultiObjectRequestWithResult> = { ...state.data };
      data[key] = {
        ...data[key],
        finished: new Date(),
        loading: false,
        results,
        dataWithResultsByGraphId: { ...data[key].dataWithResultsByGraphId },
        recordWithResponseByRefId: { ...data[key].recordWithResponseByRefId },
      };
      const currItem = data[key];

      // Update dataWithResultsByGraphId and recordWithResponseByRefId with response data
      results.forEach((result) => {
        // in some random cases the response is an array, but in all or most other cases the object is an object
        result.graphResponse.compositeResponse.forEach((response) => {
          response.body = Array.isArray(response.body) ? response.body[0] : response.body;
        });

        currItem.dataWithResultsByGraphId[result.graphId] = {
          ...currItem.dataWithResultsByGraphId[result.graphId],
          isSuccess: result.isSuccessful,
          compositeResponse: result.graphResponse.compositeResponse,
        };

        result.graphResponse.compositeResponse.forEach((recordResponse) => {
          currItem.recordWithResponseByRefId[recordResponse.referenceId] = {
            ...currItem.recordWithResponseByRefId[recordResponse.referenceId],
            response: recordResponse,
          };
        });
      });
      logger.info('[LOAD MULTI OBJ] Loaded data', { data });
      return { ...state, data, dataArray: Object.values(data) };
    }
    case 'FINISHED':
      return { ...state, loading: false, finished: true };
    default:
      throw new Error('Invalid action');
  }
}

function getNotification(dataToProcess: LoadMultiObjectRequestWithResult[]) {
  const { success, failure } = dataToProcess.reduce(
    (output, item) => {
      if (item.errorMessage) {
        output.failure += item.data.length;
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
    { success: 0, failure: 0 }
  );

  return `${getSuccessOrFailureChar('success', success)} ${success.toLocaleString()} ${pluralizeFromNumber(
    'record',
    success
  )} loaded successfully ${getSuccessOrFailureChar('failure', failure)} ${failure.toLocaleString()} ${pluralizeFromNumber(
    'record',
    failure
  )} failed`;
}

export const useLoadFile = (org: SalesforceOrgUi, serverUrl: string, apiVersion: string) => {
  const { notifyUser } = useBrowserNotifications(serverUrl);
  const [{ loading, dataArray: data, finished }, dispatch] = useReducer(reducer, {
    loading: false,
    data: null,
    dataArray: null,
    finished: false,
  });

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (finished && data) {
      notifyUser(`Your data load is finished`, { body: getNotification(data), tag: 'load-multi-object' });
    }
  }, [finished]);

  function reset() {
    dispatch({ type: 'INIT', payload: { loading: false, data: null } });
  }

  const loadFile = useCallback(
    async (dataToProcess: LoadMultiObjectRequestWithResult[]) => {
      dispatch({ type: 'INIT', payload: { loading: true, data: groupByFlat(dataToProcess, 'key') } });

      for (const currentRequest of dataToProcess) {
        try {
          dispatch({ type: 'ITEM_STARTED', payload: { key: currentRequest.key } });
          const response = await genericRequest<CompositeGraphResponseBody>(org, {
            method: 'POST',
            url: `/services/data/${apiVersion}/composite/graph`,
            body: { graphs: currentRequest.data },
            isTooling: false,
          });
          logger.info('[LOAD MULTI OBJ] Load Finished', { response });
          if (isMounted.current) {
            dispatch({ type: 'ITEM_FINISHED', payload: { key: currentRequest.key, results: response.graphs } });
          }
        } catch (ex) {
          logger.error('[LOAD MULTI OBJ] Exception', ex);
          if (isMounted.current) {
            dispatch({ type: 'ITEM_FAILED', payload: { key: currentRequest.key, errorMessage: getErrorMessage(ex) } });
          }
        }
      }
      if (isMounted.current) {
        dispatch({ type: 'FINISHED' });
      }
    },
    [org, apiVersion]
  );

  return { loadFile, reset, loading, data };
};

export default useLoadFile;
