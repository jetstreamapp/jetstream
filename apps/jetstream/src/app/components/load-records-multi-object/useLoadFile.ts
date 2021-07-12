import { logger } from '@jetstream/shared/client-logger';
import { genericRequest } from '@jetstream/shared/data';
import { getMapOf } from '@jetstream/shared/utils';
import { CompositeGraphResponse, CompositeGraphResponseBody, MapOf, SalesforceOrgUi } from '@jetstream/types';
import { useCallback, useEffect, useReducer, useRef } from 'react';
import { LoadMultiObjectRequestWithResult } from './load-records-multi-object-types';

type Action =
  | { type: 'INIT'; payload: { loading: boolean; data: MapOf<LoadMultiObjectRequestWithResult> } }
  | { type: 'ITEM_STARTED'; payload: { key: string } }
  | { type: 'ITEM_FAILED'; payload: { key: string; errorMessage: string } }
  | { type: 'ITEM_FINISHED'; payload: { key: string; results: CompositeGraphResponse[] } }
  | { type: 'FINISHED' };

interface State {
  loading: boolean;
  data: MapOf<LoadMultiObjectRequestWithResult>;
  dataArray: LoadMultiObjectRequestWithResult[];
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'INIT':
      return {
        loading: action.payload.loading,
        data: action.payload.data,
        dataArray: action.payload.data ? Object.values(action.payload.data) : null,
      };
    case 'ITEM_STARTED': {
      const { key } = action.payload;
      const data: MapOf<LoadMultiObjectRequestWithResult> = { ...state.data };
      data[key] = {
        ...data[key],
        started: new Date(),
        loading: true,
      };
      return { ...state, data, dataArray: Object.values(data) };
    }
    case 'ITEM_FAILED': {
      const { key, errorMessage } = action.payload;
      const data: MapOf<LoadMultiObjectRequestWithResult> = { ...state.data };
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
      const { key } = action.payload;
      const data: MapOf<LoadMultiObjectRequestWithResult> = { ...state.data };
      data[key] = {
        ...data[key],
        finished: new Date(),
        loading: false,
        results: action.payload.results,
        dataWithResultsByGraphId: { ...data[key].dataWithResultsByGraphId },
        recordWithResponseByRefId: { ...data[key].recordWithResponseByRefId },
      };
      const currItem = data[key];

      // Update dataWithResultsByGraphId and recordWithResponseByRefId with response data
      action.payload.results.forEach((result) => {
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
      return { ...state, loading: false };
    default:
      throw new Error('Invalid action');
  }
}

export const useLoadFile = (org: SalesforceOrgUi, apiVersion: string) => {
  const [{ loading, dataArray: data }, dispatch] = useReducer(reducer, {
    loading: false,
    data: null,
    dataArray: null,
  });

  const isMounted = useRef<boolean>(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  function reset() {
    dispatch({ type: 'INIT', payload: { loading: false, data: null } });
  }

  const loadFile = useCallback(
    async (dataToProcess: LoadMultiObjectRequestWithResult[]) => {
      dispatch({ type: 'INIT', payload: { loading: true, data: getMapOf(dataToProcess, 'key') } });

      for (let currentRequest of dataToProcess) {
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
            dispatch({ type: 'ITEM_FAILED', payload: { key: currentRequest.key, errorMessage: ex.message } });
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
