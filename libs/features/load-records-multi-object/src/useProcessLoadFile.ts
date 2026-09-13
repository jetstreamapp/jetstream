import { logger } from '@jetstream/shared/client-logger';
import { getFileParseErrorMessage } from '@jetstream/shared/ui-utils';
import { getErrorMessage } from '@jetstream/shared/utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { fireToast } from '@jetstream/ui';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useCallback, useEffect, useRef } from 'react';
import { LoadMultiObjectDataError } from './load-records-multi-object-types';
import { buildDataGraph, parseWorkbook } from './load-records-multi-object-utils';
import {
  datasetsState,
  dateFormatState,
  fileParsingState,
  graphErrorsState,
  groupsByRefIdState,
  insertNullsState,
  parseErrorsState,
  requestsState,
  workbookErrorsState,
} from './load-records-multi-object.state';

function toWorkbookError(message: string): LoadMultiObjectDataError {
  return {
    property: null,
    worksheet: 'Unknown',
    location: null,
    locationType: 'SHEET',
    message,
  };
}

/**
 * Parses + validates the uploaded workbook into datasets, then derives the dependency graph.
 * Datasets and errors coexist: the preview always renders from datasets, while the load button
 * is only enabled once requests exist (no blocking errors anywhere).
 */
export const useProcessLoadFile = (org: SalesforceOrgUi, apiVersion: string) => {
  const [loading, setLoading] = useAtom(fileParsingState);
  const [datasets, setDatasets] = useAtom(datasetsState);
  const parseErrors = useAtomValue(parseErrorsState);
  const setWorkbookErrors = useSetAtom(workbookErrorsState);
  const setGraphErrors = useSetAtom(graphErrorsState);
  const setRequests = useSetAtom(requestsState);
  const setGroupsByRefId = useSetAtom(groupsByRefIdState);
  const dateFormat = useAtomValue(dateFormatState);
  const insertNulls = useAtomValue(insertNullsState);

  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const processFile = useCallback(
    async (source: ArrayBuffer) => {
      setLoading(true);
      setDatasets(null);
      setWorkbookErrors([]);
      try {
        const { datasets: parsedDatasets, workbookErrors } = await parseWorkbook(source, org);
        logger.info('[LOAD MULTI OBJ]', { datasets: parsedDatasets });
        if (isMounted.current) {
          setDatasets(parsedDatasets);
          setWorkbookErrors(workbookErrors);
        }
      } catch (ex) {
        logger.error('[LOAD MULTI OBJ] Error parsing file', ex);
        // Nothing parsed, so the review panel that shows workbook errors is not rendered - the toast is what the user sees
        const message = getFileParseErrorMessage(ex);
        fireToast({ message, type: 'error' });
        if (isMounted.current) {
          setDatasets([]);
          setWorkbookErrors([toWorkbookError(message)]);
        }
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    },
    [org, setDatasets, setLoading, setWorkbookErrors],
  );

  // Derive the dependency graph whenever the datasets or load options change.
  // Graph building is skipped while parse errors exist - the per-sheet preview still renders from datasets.
  useEffect(() => {
    if (!datasets?.length || parseErrors.length) {
      setRequests(null);
      setGraphErrors([]);
      setGroupsByRefId({});
      return;
    }
    try {
      const { requests, errors, groupsByRefId } = buildDataGraph(datasets, apiVersion, { dateFormat, insertNulls });
      logger.info('[LOAD MULTI OBJ] Graph', { requests, errors, groupsByRefId });
      setGraphErrors(errors);
      setGroupsByRefId(groupsByRefId);
      setRequests(errors.length ? null : requests);
    } catch (ex) {
      logger.error('[LOAD MULTI OBJ] Error building graph', ex);
      setGraphErrors([toWorkbookError(getErrorMessage(ex))]);
      setGroupsByRefId({});
      setRequests(null);
    }
  }, [datasets, parseErrors, apiVersion, dateFormat, insertNulls, setGraphErrors, setGroupsByRefId, setRequests]);

  return { processFile, loading };
};

export default useProcessLoadFile;
