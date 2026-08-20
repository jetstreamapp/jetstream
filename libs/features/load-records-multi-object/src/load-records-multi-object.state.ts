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
import { getRecordCount } from './load-records-multi-object-utils';

/**
 * State lives in atoms (not component state) so an accidental navigation away from the page
 * does not silently discard a parsed file or a finished load - parity with the single-object load.
 */

export const inputFilenameState = atomWithReset<Maybe<string>>(null);

export const inputFileTypeState = atomWithReset<Maybe<LocalOrGoogle>>(null);

/** Drive file id for a Google Sheet input - recorded on the Data History entry's input source */
export const inputGoogleFileIdState = atomWithReset<Maybe<string>>(null);

/** Per-load opt out of Data History capture */
export const skipDataHistoryState = atomWithReset(false);

export const fileParsingState = atomWithReset(false);

/** Parsed worksheets - always populated after parse, even when they contain errors, so the preview can render */
export const datasetsState = atomWithReset<LoadMultiObjectData[] | null>(null);

/** Problems that apply to the workbook rather than one worksheet (e.g. skipped sheets, no data worksheets at all) */
export const workbookErrorsState = atomWithReset<LoadMultiObjectDataError[]>([]);

/**
 * Every problem found while parsing/validating, derived from the datasets so that editing a worksheet's
 * configuration (operation/external Id) immediately re-derives what is blocking and what is not.
 */
const allParseProblemsState = atom((get) => [...get(workbookErrorsState), ...(get(datasetsState) || []).flatMap(({ errors }) => errors)]);

/** Blocking errors found while parsing/validating the workbook (workbook-level + per-sheet) */
export const parseErrorsState = atom((get) => get(allParseProblemsState).filter(({ severity }) => severity !== 'warning'));

/** Non-blocking warnings (e.g. skipped sheets, columns that do not match a field on the object) */
export const parseWarningsState = atom((get) => get(allParseProblemsState).filter(({ severity }) => severity === 'warning'));

/** Errors found while building the dependency graph (unknown references, cycles, oversized groups) */
export const graphErrorsState = atomWithReset<LoadMultiObjectDataError[]>([]);

/** The composite graph requests, present only when the file is fully valid */
export const requestsState = atomWithReset<LoadMultiObjectRequestWithResult[] | null>(null);

/** Group membership for every record, present whenever groups could be computed (even with errors) */
export const groupsByRefIdState = atomWithReset<Record<string, LoadMultiObjectGroupInfo>>({});

export const dateFormatState = atomWithReset<string>(DATE_FORMATS.MM_DD_YYYY);

export const insertNullsState = atomWithReset(false);

export const currentStepIdxState = atomWithReset(0);

/**
 * Bumped whenever content above the preview grids is shown or hidden (the upload section is expanded/collapsed,
 * a warning is dismissed). The grids measure their available height once, so this tells them to re-measure
 * and take over the space that was freed up.
 */
export const previewLayoutVersionState = atomWithReset(0);

export const loadRunsState = atomWithReset<LoadMultiObjectRun[]>([]);

export const loadIsRunningState = atomWithReset(false);

export const loadProgressState = atomWithReset<LoadMultiObjectProgress | null>(null);

export const allBlockingErrorsState = atom((get) => [...get(parseErrorsState), ...get(graphErrorsState)]);

export const totalRecordsToLoadState = atom((get) => getRecordCount(get(requestsState) || []));

export const isReadyToLoadState = atom((get) => {
  // Requests can exist without records (e.g. nothing was linked into a graph) - that is never loadable
  return get(totalRecordsToLoadState) > 0 && get(allBlockingErrorsState).length === 0;
});

/**
 * `keepSkipDataHistory`: the per-run "don't save this load" opt-out sits on the upload step, so the
 * user can tick it BEFORE choosing a file — choosing (or re-choosing) the file must not silently undo
 * it. Start Over and an org change are a new run, so those reset it like everything else.
 */
export const resetLoadRecordsMultiObjectState = atom(
  null,
  (_get, set, { keepSkipDataHistory = false }: { keepSkipDataHistory?: boolean } = {}) => {
    set(inputFilenameState, RESET);
    set(inputFileTypeState, RESET);
    set(inputGoogleFileIdState, RESET);
    if (!keepSkipDataHistory) {
      set(skipDataHistoryState, RESET);
    }
    set(fileParsingState, RESET);
    set(datasetsState, RESET);
    set(workbookErrorsState, RESET);
    set(graphErrorsState, RESET);
    set(requestsState, RESET);
    set(groupsByRefIdState, RESET);
    set(currentStepIdxState, RESET);
    set(previewLayoutVersionState, RESET);
    set(loadRunsState, RESET);
    set(loadIsRunningState, RESET);
    set(loadProgressState, RESET);
    // dateFormat/insertNulls are user preferences within the session - intentionally kept across Start Over
  },
);
