import { logger } from '@jetstream/shared/client-logger';
import { getErrorMessage } from '@jetstream/shared/utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { useCallback, useEffect, useReducer, useRef } from 'react';
import type * as XLSX from 'xlsx';
import { LoadMultiObjectData, LoadMultiObjectDataError, LoadMultiObjectRequestWithResult } from './load-records-multi-object-types';
import { getDataGraph, parseWorkbook } from './load-records-multi-object-utils';

type Action =
  | { type: 'INIT'; payload: { loading: boolean } }
  | { type: 'PROCESSED_DATASET'; payload: { data: LoadMultiObjectData[] } }
  | { type: 'SUCCESS'; payload: { data: LoadMultiObjectRequestWithResult[] } }
  | { type: 'FAILURE'; payload: { errors: any } };

interface State {
  loading: boolean;
  dataSet: LoadMultiObjectData[] | null;
  dataGraph: LoadMultiObjectRequestWithResult[] | null;
  errors: LoadMultiObjectDataError[];
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'INIT':
      return { ...state, loading: action.payload.loading, errors: [], dataSet: null, dataGraph: null };
    case 'PROCESSED_DATASET':
      return { ...state, dataSet: action.payload.data };
    case 'SUCCESS':
      return { ...state, loading: false, dataGraph: action.payload.data };
    case 'FAILURE':
      return { ...state, loading: false, errors: action.payload.errors || [], dataGraph: null };
    default:
      throw new Error('Invalid action');
  }
}

export const useValidateLoadFile = (org: SalesforceOrgUi, apiVersion: string, options: { dateFormat: string; insertNulls: boolean }) => {
  const { dateFormat, insertNulls } = options;
  const [{ loading, dataSet, dataGraph, errors }, dispatch] = useReducer(reducer, {
    loading: false,
    dataSet: null,
    dataGraph: null,
    errors: [],
  });

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (dataSet && !errors.length) {
      processFileGraph();
    }
  }, [errors, dataSet, dateFormat, insertNulls]);

  function processFileGraph() {
    if (!dataSet) {
      return;
    }
    try {
      const data = getDataGraph(dataSet, apiVersion, { dateFormat, insertNulls });
      logger.info('[LOAD MULTI OBJ] Data', { data });
      dispatch({ type: 'SUCCESS', payload: { data } });
    } catch (ex) {
      const errors = dataSet.flatMap((dataset) => dataset.errors);
      logger.error('[LOAD MULTI OBJ] Errors', { errors });
      if (errors.length) {
        dispatch({ type: 'FAILURE', payload: { errors } });
      } else {
        // Fallback in case there was an exception thrown but no errors specified
        dispatch({
          type: 'FAILURE',
          payload: {
            errors: [
              {
                property: null,
                worksheet: 'Unknown',
                location: null,
                message: getErrorMessage(ex),
              },
            ],
          },
        });
      }
    }
  }

  function reset() {
    dispatch({ type: 'INIT', payload: { loading: false } });
  }

  const processFile = useCallback(
    async (workbook: XLSX.WorkBook) => {
      dispatch({ type: 'INIT', payload: { loading: true } });
      try {
        logger.info('[LOAD MULTI OBJ]', { workbook });
        const datasets = await parseWorkbook(workbook, org);

        logger.info('[LOAD MULTI OBJ]', { datasets });
        if (isMounted.current) {
          const errors = datasets.flatMap((dataset) => dataset.errors);

          if (errors.length) {
            logger.error('[LOAD MULTI OBJ] Errors', { errors });
            dispatch({ type: 'FAILURE', payload: { errors } });
          } else {
            // this will automatically initiate the next part in the process
            dispatch({ type: 'PROCESSED_DATASET', payload: { data: datasets } });
          }
        }
      } catch (ex) {
        if (isMounted.current) {
          // Fallback in case there was an exception thrown but no errors specified
          logger.error('[LOAD MULTI OBJ] Data', ex);
          dispatch({
            type: 'FAILURE',
            payload: {
              errors: [
                {
                  property: null,
                  worksheet: 'Unknown',
                  location: null,
                  message: getErrorMessage(ex),
                },
              ],
            },
          });
        }
      }
    },
    [org]
  );

  return { processFile, reset, loading, data: dataGraph, errors };
};

export default useValidateLoadFile;
