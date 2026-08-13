import { DATE_FORMATS } from '@jetstream/shared/constants';
import { LocalOrGoogle, Maybe } from '@jetstream/types';
import { atom } from 'jotai';
import { RESET, atomWithReset } from 'jotai/utils';
import {
  LoadMultiObjectData,
  LoadMultiObjectDataError,
  LoadMultiObjectGroupInfo,
  LoadMultiObjectProgress,
  LoadMultiObjectRequestWithResult,
  LoadMultiObjectRun,
} from './load-records-multi-object-types';

/**
 * State lives in atoms (not component state) so an accidental navigation away from the page
 * does not silently discard a parsed file or a finished load - parity with the single-object load.
 */

export const inputFilenameState = atomWithReset<Maybe<string>>(null);

export const inputFileTypeState = atomWithReset<Maybe<LocalOrGoogle>>(null);

export const fileParsingState = atomWithReset(false);

/** Parsed worksheets - always populated after parse, even when they contain errors, so the preview can render */
export const datasetsState = atomWithReset<LoadMultiObjectData[] | null>(null);

/** Blocking errors found while parsing/validating the workbook (workbook-level + per-sheet) */
export const parseErrorsState = atomWithReset<LoadMultiObjectDataError[]>([]);

/** Non-blocking warnings (e.g. sheets skipped by the "instructions" name rule) */
export const parseWarningsState = atomWithReset<LoadMultiObjectDataError[]>([]);

/** Errors found while building the dependency graph (unknown references, cycles, oversized groups) */
export const graphErrorsState = atomWithReset<LoadMultiObjectDataError[]>([]);

/** The composite graph requests, present only when the file is fully valid */
export const requestsState = atomWithReset<LoadMultiObjectRequestWithResult[] | null>(null);

/** Group membership for every record, present whenever groups could be computed (even with errors) */
export const groupsByRefIdState = atomWithReset<Record<string, LoadMultiObjectGroupInfo>>({});

export const dateFormatState = atomWithReset<string>(DATE_FORMATS.MM_DD_YYYY);

export const insertNullsState = atomWithReset(false);

export const currentStepIdxState = atomWithReset(0);

export const loadRunsState = atomWithReset<LoadMultiObjectRun[]>([]);

export const loadIsRunningState = atomWithReset(false);

export const loadProgressState = atomWithReset<LoadMultiObjectProgress | null>(null);

export const allBlockingErrorsState = atom((get) => [...get(parseErrorsState), ...get(graphErrorsState)]);

export const isReadyToLoadState = atom((get) => {
  const requests = get(requestsState);
  return !!requests?.length && get(allBlockingErrorsState).length === 0;
});

export const resetLoadRecordsMultiObjectState = atom(null, (_get, set) => {
  set(inputFilenameState, RESET);
  set(inputFileTypeState, RESET);
  set(fileParsingState, RESET);
  set(datasetsState, RESET);
  set(parseErrorsState, RESET);
  set(parseWarningsState, RESET);
  set(graphErrorsState, RESET);
  set(requestsState, RESET);
  set(groupsByRefIdState, RESET);
  set(currentStepIdxState, RESET);
  set(loadRunsState, RESET);
  set(loadIsRunningState, RESET);
  set(loadProgressState, RESET);
  // dateFormat/insertNulls are user preferences within the session - intentionally kept across Start Over
});
