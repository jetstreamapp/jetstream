import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { bulkApiAbortJob, bulkApiGetJob, bulkApiGetRecords } from '@jetstream/shared/data';
import { checkIfBulkApiJobIsDone, convertDateToLocale, formatNumber, tracker, useBrowserNotifications } from '@jetstream/shared/ui-utils';
import { buildBulkResultRow, getErrorMessage, getSuccessOrFailureChar, pluralizeFromNumber } from '@jetstream/shared/utils';
import {
  ApiMode,
  BulkJobBatchInfo,
  BulkJobResultRecord,
  BulkJobWithBatches,
  DownloadAction,
  DownloadModalData,
  DownloadScope,
  DownloadType,
  FieldMapping,
  InsertUpdateUpsertDelete,
  LoadDataBulkApiStatusPayload,
  LoadDataPayload,
  Maybe,
  PrepareDataPayload,
  PrepareDataResponse,
  SalesforceOrgUi,
  ViewModalData,
} from '@jetstream/types';
import {
  AssistiveStatus,
  ButtonGroupContainer,
  FileDownloadModal,
  Grid,
  Icon,
  ProgressRing,
  SalesforceLogin,
  ScopedNotification,
  Spinner,
  Tooltip,
  ariaDisabledButtonProps,
  fireToast,
} from '@jetstream/ui';
import {
  LoadRecordsBulkApiResultsTable,
  LoadRecordsResultsModal,
  fromJetstreamEvents,
  getFieldHeaderFromMapping,
  useAmplitude,
} from '@jetstream/ui-core';
import { applicationCookieState, googleDriveAccessState, selectSkipFrontdoorAuth } from '@jetstream/ui/app-state';
import { DataHistoryEntryHandle, buildBulkJobHistoryCounts } from '@jetstream/ui/data-history';
import { useAtomValue } from 'jotai';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LoadFailureReach, captureBulkApiLoadResults, settleHistoryForFailedLoad } from '../../utils/data-history-capture';
import {
  BULK_JOB_POLL_MAX_CHECKS,
  LoadTypeDisplayNames,
  getBulkJobPollInterval,
  loadBulkApiData,
  prepareData,
} from '../../utils/load-records-process';
import {
  alignBatchSourceRecordsToResults,
  collectFailedRecordsForRetry,
  createBatchResultsFetcher,
  fetchBulkApiAllBatchResults,
  getLoadResultsHeader,
  isDeleteLoadType,
} from './load-results-utils';
import { extractRetryRecords, registerRetryRecord } from './retry-record-map';

type Status = 'Preparing Data' | 'Uploading Data' | 'Processing Data' | 'Aborting' | 'Finished' | 'Error';

const STATUSES: {
  PREPARING: Status;
  UPLOADING: Status;
  PROCESSING: Status;
  ABORTING: Status;
  FINISHED: Status;
  ERROR: Status;
} = {
  PREPARING: 'Preparing Data',
  UPLOADING: 'Uploading Data',
  PROCESSING: 'Processing Data',
  ABORTING: 'Aborting',
  FINISHED: 'Finished',
  ERROR: 'Error',
};

const ABORTABLE_STATUSES = new Set<Status>([STATUSES.PREPARING, STATUSES.UPLOADING, STATUSES.PROCESSING, STATUSES.ABORTING]);
export interface LoadRecordsBulkApiResultsProps {
  selectedOrg: SalesforceOrgUi;
  selectedSObject: string;
  fieldMapping: FieldMapping;
  inputFileData: any[];
  inputZipFileData: Maybe<ArrayBuffer>;
  apiMode: ApiMode;
  loadType: InsertUpdateUpsertDelete;
  externalId?: Maybe<string>;
  batchSize: number;
  insertNulls: boolean;
  assignmentRuleId?: Maybe<string>;
  serialMode: boolean;
  dateFormat: string;
  /** Already-prepared records for retry — skips prepareData when provided */
  preparedInputData?: any[];
  /** Data History capture handle for this run (captures nothing when disabled/opted out) */
  historyHandle: DataHistoryEntryHandle;
  onFinish: (results: { success: number; failure: number; failedRecords: any[] }) => void;
  /** Called when user selects specific records to retry from the results modal */
  onRetrySelected?: (selectedRows: any[]) => void;
  /** Called to retry all failed records from this run */
  onRetryAll?: () => void;
  /** Number of failed records available for retry — used for button label */
  failedRecordCount?: number;
}

export const LoadRecordsBulkApiResults = ({
  selectedOrg,
  selectedSObject,
  fieldMapping,
  inputFileData,
  inputZipFileData,
  apiMode,
  loadType,
  externalId,
  batchSize,
  insertNulls,
  assignmentRuleId,
  serialMode,
  dateFormat,
  preparedInputData,
  historyHandle,
  onFinish,
  onRetrySelected,
  onRetryAll,
  failedRecordCount,
}: LoadRecordsBulkApiResultsProps) => {
  const isMounted = useRef(true);
  const isAborted = useRef(false);
  const pollingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Ref to avoid stale closures in stable useCallback/useEffect — always call onFinishRef.current
  const onFinishRef = useRef(onFinish);
  // eslint-disable-next-line react-hooks/refs -- latest-ref pattern: the render-time assignment is the point
  onFinishRef.current = onFinish;
  const { trackEvent } = useAmplitude();
  const { serverUrl, google_apiKey, google_appId, google_clientId } = useAtomValue(applicationCookieState);
  const { hasGoogleDriveAccess, googleShowUpgradeToPro } = useAtomValue(googleDriveAccessState);
  const skipFrontDoorAuth = useAtomValue(selectSkipFrontdoorAuth);
  const [preparedData, setPreparedData] = useState<PrepareDataResponse>();
  const [prepareDataProgress, setPrepareDataProgress] = useState(0);
  const [status, setStatus] = useState<Status>(STATUSES.PREPARING);
  const [fatalError, setFatalError] = useState<Maybe<string>>(null);
  const [downloadError, setDownloadError] = useState<Maybe<string>>(null);
  const [jobInfo, setJobInfo] = useState<BulkJobWithBatches>();
  const [batchSummary, setBatchSummary] = useState<LoadDataBulkApiStatusPayload>();
  const [processingStartTime, setProcessingStartTime] = useState<Maybe<string>>(null);
  const [processingEndTime, setProcessingEndTime] = useState<Maybe<string>>(null);
  // Salesforce changes order of batches, so we want to ensure order is retained based on the input file
  const [batchIdByIndex, setBatchIdByIndex] = useState<Record<string, number>>();
  const [intervalCount, setIntervalCount] = useState<number>(0);
  // Polling gives up after BULK_JOB_POLL_MAX_CHECKS so a runaway job doesn't poll forever; the user can resume it
  const [pollingTimedOut, setPollingTimedOut] = useState(false);
  const [downloadModalData, setDownloadModalData] = useState<DownloadModalData>({
    open: false,
    data: [],
    header: [],
    fileNameParts: [],
  });
  const [resultsModalData, setResultsModalData] = useState<ViewModalData>({ open: false, data: [], header: [], type: 'results' });
  const [downloadState, setDownloadState] = useState<DownloadScope | null>(null);
  const { notifyUser } = useBrowserNotifications(serverUrl);

  /**
   * Batches are capped by CSV size as well as by record count, so a batch of wide records gets split
   * into smaller ones and more batches are submitted than the configured batch size implies. Detected
   * by comparing the submitted batch count against what the record count alone would produce.
   */
  const autoSplitBatchCount =
    batchSummary && preparedData && batchSize > 0
      ? Math.max(batchSummary.totalBatches - Math.ceil(preparedData.data.length / batchSize), 0)
      : 0;

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (pollingTimerRef.current !== null) {
        clearTimeout(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
      // Unmounting mid-load abandons the run: polling stops, so nothing would ever settle the
      // history entry — see `abandonIfUnsettled` for why a stranded entry matters
      historyHandle.abandonIfUnsettled('The load was still running when you left the page, so its final outcome was not recorded.');
    };
  }, [historyHandle]);

  /**
   * Every failed exit settles through here. The component status, the parent's `onFinish` (every
   * input record counts as failed), the history entry, and the user notification are four channels
   * that must move together — with them in one place no terminal path can update some and forget
   * the rest (a forgotten history call strands the entry `in-progress` until unmount). `fatalError`,
   * timestamps, the mock job info and error tracking stay with the caller: which of them each exit
   * sets is its own concern.
   *
   * `reached` — whether any record may have reached Salesforce; how the history entry is settled for
   * each value lives in `settleHistoryForFailedLoad`. Prepare failures are always 'none'; the upload
   * exits derive it from `anyBatchAccepted`, since `loadBulkApiData` throws both before any batch
   * is sent (job creation) and after every batch was (the trailing job-status read).
   */
  function failLoad(
    errorMessage: string,
    { reached, notificationBody = `❌ ${errorMessage}` }: { reached: LoadFailureReach; notificationBody?: string },
  ) {
    setStatus(STATUSES.ERROR);
    onFinishRef.current({ success: 0, failure: inputFileData.length, failedRecords: [] });
    settleHistoryForFailedLoad(historyHandle, { reached, attemptedCount: inputFileData.length, errorMessage });
    notifyUser(`Your ${LoadTypeDisplayNames[loadType]} data load failed`, { body: notificationBody, tag: 'load-records' });
  }

  useEffect(() => {
    if (batchSummary && batchSummary.batchSummary) {
      const batchSummariesWithId = batchSummary.batchSummary.filter((batch) => batch.id);
      if (Array.isArray(batchSummariesWithId)) {
        setBatchIdByIndex(
          batchSummariesWithId.reduce((output: Record<string, number>, batch) => {
            if (batch.id) {
              output[batch.id] = batch.batchNumber;
            }
            return output;
          }, {}),
        );
      }
    }
  }, [batchSummary]);

  /**
   * Fetch the latest job status from Salesforce and store it, which re-triggers the polling effect.
   * Salesforce returns batches in an arbitrary order, so they are re-ordered to match the input file.
   * If the request fails, jobInfo is re-set with a fresh reference so polling carries on regardless.
   */
  async function pollJobStatus() {
    if (!isMounted.current || !batchIdByIndex || !jobInfo?.id) {
      return;
    }
    try {
      const jobInfoWithBatches = await bulkApiGetJob(selectedOrg, jobInfo.id);
      if (!isMounted.current) {
        return;
      }
      const batches: BulkJobBatchInfo[] = [];
      // re-order (if needed) while keeping the array dense
      jobInfoWithBatches.batches.forEach((batch) => {
        batches[batchIdByIndex[batch.id]] = batch;
      });
      jobInfoWithBatches.batches = batches.filter(Boolean);
      setJobInfo(jobInfoWithBatches);
    } catch (ex) {
      logger.warn('Error polling bulk API job status', ex);
      if (!isMounted.current) {
        return;
      }
      // Set a new jobInfo reference to re-trigger the polling effect
      setJobInfo((currentJobInfo) => (currentJobInfo ? { ...currentJobInfo } : currentJobInfo));
    }
    setIntervalCount((currentIntervalCount) => currentIntervalCount + 1);
  }

  /** Polling gave up on a long-running job - check it right away and start a fresh polling window */
  function handleResumePolling() {
    trackEvent(ANALYTICS_KEYS.load_PollingResumed, { loadType });
    setPollingTimedOut(false);
    setIntervalCount(0);
    pollJobStatus();
  }

  /**
   * When jobInfo is modified, check to see if everything is done
   * If not done and status is processing, then continue polling
   */
  useEffect(() => {
    if (jobInfo && status !== STATUSES.ERROR && status !== STATUSES.FINISHED && batchSummary && preparedData) {
      const isDone = checkIfBulkApiJobIsDone(jobInfo, batchSummary.submittedBatchCount);
      if (isDone) {
        setStatus(STATUSES.FINISHED);
        const numSuccess = jobInfo.numberRecordsProcessed - jobInfo.numberRecordsFailed;
        const numFailure = jobInfo.numberRecordsFailed + preparedData.errors.length;
        notifyUser(`Your ${jobInfo.operation} data load is finished`, {
          body: `${getSuccessOrFailureChar('success', numSuccess)} ${numSuccess.toLocaleString()} ${pluralizeFromNumber(
            'record',
            numSuccess,
          )} loaded successfully - ${getSuccessOrFailureChar('failure', numFailure)} ${numFailure.toLocaleString()} ${pluralizeFromNumber(
            'record',
            numFailure,
          )} failed`,
          tag: 'load-records',
        });

        // The retry collector and the history capture below both need every completed batch's
        // results — one memoized fetcher so each batch is downloaded once, not twice
        const fetchBatchResults = createBatchResultsFetcher(selectedOrg, jobInfo.id ?? '');

        // Fetch failed records for retry capability, then emit completion with the recovered
        // failedRecords. We intentionally delay `onFinish` until the fetch resolves so that the
        // parent stays in `loadInProgress` until the run's state is fully populated — this
        // prevents user actions from racing with the retry-record lookup.
        (async () => {
          const failedRecords = await collectFailedRecordsForRetry({
            numFailure,
            jobInfo,
            batchSummary,
            preparedData,
            loadType,
            fetchBatchResults,
          });
          if (isMounted.current) {
            onFinishRef.current({ success: numSuccess, failure: numFailure, failedRecords });
          }
        })();

        // Proactively capture per-record results to Data History even if the user never clicks
        // download — bulk results expire server-side (~7 days). Fully fire-and-forget, and safe to
        // reach more than once: `finalize()` is one-shot on the handle, so a re-entered done-branch
        // cannot re-fetch every batch's results.
        //
        // The permanent record anchors on how many records were IN THE FILE, not on the job's
        // processed/failed numbers (see `buildBulkJobHistoryCounts`). The notification above keeps
        // the job's own numbers, as it always has.
        captureBulkApiLoadResults({
          handle: historyHandle,
          selectedOrg,
          jobInfo,
          batchSummary,
          preparedData,
          loadType,
          fields: getFieldHeaderFromMapping(fieldMapping),
          counts: buildBulkJobHistoryCounts(jobInfo, {
            submitted: preparedData.data.length + preparedData.errors.length,
            processingErrors: preparedData.errors.length,
          }),
          // Set when batch submission stopped early (`loadError` with a job already created) — the
          // reason those records never reached Salesforce belongs on the entry
          errorMessage: fatalError ?? undefined,
          fetchBatchResults,
        });
      } else if (status === STATUSES.PROCESSING || status === STATUSES.ABORTING) {
        if (intervalCount >= BULK_JOB_POLL_MAX_CHECKS) {
          // Stop polling and hand control to the user - the job keeps running in Salesforce regardless.
          // Guarded so a status change (e.g. abort) after timing out doesn't re-fire the event.
          if (!pollingTimedOut) {
            setPollingTimedOut(true);
            trackEvent(ANALYTICS_KEYS.load_PollingTimedOut, { loadType, checkCount: intervalCount });
          }
        } else {
          pollingTimerRef.current = setTimeout(() => {
            pollingTimerRef.current = null;
            pollJobStatus();
          }, getBulkJobPollInterval(intervalCount));
        }
      }
    }
    return () => {
      if (pollingTimerRef.current !== null) {
        clearTimeout(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobInfo, status]);

  const doPrepareData = useCallback(async () => {
    try {
      setStatus(STATUSES.PREPARING);
      setProcessingStartTime(convertDateToLocale(new Date(), { timeStyle: 'medium' }));
      setFatalError(null);

      // For retry: data is already prepared, skip transformation
      if (preparedInputData) {
        const dateString = convertDateToLocale(new Date(), { timeStyle: 'medium' });
        const preparedDataResponse: PrepareDataResponse = {
          data: preparedInputData,
          errors: [],
          queryErrors: [],
        };
        setStatus(STATUSES.UPLOADING);
        setPreparedData(preparedDataResponse);
        setProcessingEndTime(dateString);
        setPrepareDataProgress(100);
        return preparedDataResponse;
      }

      const prepareDataPayload: PrepareDataPayload = {
        org: selectedOrg,
        data: inputFileData,
        fieldMapping,
        sObject: selectedSObject,
        insertNulls,
        dateFormat,
        apiMode,
      };

      const preparedDataResponse = await prepareData(prepareDataPayload, (progress) => {
        setPrepareDataProgress(progress || 0);
      });

      if (isAborted.current) {
        throw new Error('Aborted');
      }

      const dateString = convertDateToLocale(new Date(), { timeStyle: 'medium' });

      if (!preparedDataResponse?.data.length) {
        const queryErrors = preparedDataResponse?.queryErrors?.length ? preparedDataResponse.queryErrors.join('\n') : null;
        if (queryErrors) {
          setFatalError(queryErrors);
        }
        // processing failed on every record
        setPreparedData(preparedDataResponse);
        setProcessingEndTime(dateString);
        // mock response to ensure results table is visible
        setJobInfo({
          concurrencyMode: serialMode ? 'Serial' : 'Parallel',
          contentType: 'CSV',
          createdById: null,
          createdDate: null,
          id: null,
          object: selectedSObject,
          operation: loadType,
          state: 'Failed',
          systemModstamp: null,
          apexProcessingTime: 0,
          apiActiveProcessingTime: 0,
          apiVersion: 0,
          numberBatchesCompleted: 0,
          numberBatchesFailed: 0,
          numberBatchesInProgress: 0,
          numberBatchesQueued: 0,
          numberBatchesTotal: 0,
          numberRecordsFailed: 0,
          numberRecordsProcessed: 0,
          numberRetries: 0,
          totalProcessingTime: 0,
          batches: [],
        });
        failLoad(queryErrors ?? 'Pre-processing records failed', {
          reached: 'none',
          notificationBody: `❌ Pre-processing records failed.`,
        });
      } else {
        setStatus(STATUSES.UPLOADING);
        setPreparedData(preparedDataResponse);
        setProcessingEndTime(dateString);

        return preparedDataResponse;
      }
    } catch (ex) {
      logger.error('ERROR', ex);
      setFatalError(getErrorMessage(ex));
      failLoad(getErrorMessage(ex), { reached: 'none' });
      // A user-initiated abort throws 'Aborted' through this same path — keep the UI messaging but
      // don't report it as an application error.
      if (!isAborted.current) {
        tracker.error('Error preparing bulk api data', ex);
      }
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = useCallback(async () => {
    isAborted.current = false;

    const preparedDataResponse = await doPrepareData();

    if (!preparedDataResponse) {
      return;
    }

    // Flipped by the first status callback that carries an accepted batch — the only signal the
    // failure exits below have for whether records reached Salesforce before the throw
    let anyBatchAccepted = false;
    try {
      const loadDataPayload: LoadDataPayload = {
        org: selectedOrg,
        data: preparedDataResponse.data,
        zipData: inputZipFileData,
        sObject: selectedSObject,
        apiMode,
        type: loadType,
        batchSize,
        assignmentRuleId,
        serialMode,
        externalId,
      };

      const { loadError, jobInfo } = await loadBulkApiData(
        loadDataPayload,
        (resultsSummary) => {
          setBatchSummary(resultsSummary);
          if (Array.isArray(resultsSummary?.jobInfo.batches) && resultsSummary?.jobInfo.batches.length) {
            anyBatchAccepted = true;
            setJobInfo(resultsSummary.jobInfo);
          }
        },
        () => isAborted.current,
      );

      if (loadError) {
        logger.error('ERROR', loadError);
        setFatalError(loadError.message);
        if (jobInfo && jobInfo.batches.length) {
          setJobInfo(jobInfo);
          setStatus(STATUSES.PROCESSING);
        } else {
          // No batch came back on the job. Normally none was accepted (nothing reached Salesforce,
          // same as a prepare failure) — but a job-status read that dropped accepted batches is the
          // 'unknown' case, and the ref is the only thing that tells the two apart.
          failLoad(loadError.message, { reached: anyBatchAccepted ? 'unknown' : 'none' });
        }
        // A user-initiated abort surfaces through the same loadError path — keep the UI messaging but
        // don't report it as an application error. Aborting also makes Salesforce reject any in-flight
        // or subsequent batch, so every error in this payload is downstream of the abort.
        if (!isAborted.current) {
          tracker.error('Error loading batches', loadError, {
            specificErrors: loadError.additionalErrors.map((error) => ({
              message: error.message,
              stack: error.stack,
            })),
          });
        }
      } else {
        setJobInfo(jobInfo);
        setStatus(STATUSES.PROCESSING);
      }
    } catch (ex) {
      logger.error('ERROR', ex);
      setFatalError(getErrorMessage(ex));
      // `bulkApiCreateJob` throws before anything is sent; the trailing `bulkApiGetJob` throws after
      // every batch was — Salesforce is still processing that job, so its outcome is unknown
      failLoad(getErrorMessage(ex), { reached: anyBatchAccepted ? 'unknown' : 'none' });
      return;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function getUploadingText() {
    if (
      !batchSummary ||
      !(status === STATUSES.UPLOADING || status === STATUSES.PROCESSING) ||
      batchSummary.totalBatches === jobInfo?.batches?.length
    ) {
      return '';
    }
    const completedCount = batchSummary.batchSummary.filter((item) => item.completed).length;
    if (completedCount >= batchSummary.totalBatches) {
      return '';
    }
    return `Uploading batch ${completedCount + 1} of ${batchSummary.totalBatches}`;
  }

  async function handleDownloadOrViewRecords({
    scope,
    action,
    type,
    batch,
    batchIndex,
  }:
    | {
        scope: 'all';
        action: DownloadAction;
        type: 'results';
        batch?: never;
        batchIndex?: never;
      }
    | {
        scope: 'batch';
        action: DownloadAction;
        type: DownloadType;
        batch: BulkJobBatchInfo;
        batchIndex: number;
      }): Promise<void> {
    try {
      if (!batchSummary || !jobInfo?.id || !preparedData) {
        return;
      }
      if (downloadError) {
        setDownloadError(null);
      }

      setDownloadState(scope);

      let results: BulkJobResultRecord[];
      let records: any[] = preparedData.data;
      let removedBatches = false;
      const isDelete = isDeleteLoadType(loadType);

      if (scope === 'all') {
        // Download results across all completed batches, combining with the submitted records
        const allBatchResults = await fetchBulkApiAllBatchResults({ selectedOrg, jobInfo, batchSummary, preparedData, loadType });
        results = allBatchResults.results;
        records = allBatchResults.records;
        removedBatches = allBatchResults.removedBatches;
      } else {
        // Download results for a single batch
        // download records, combine results from salesforce with actual records, open download modal
        results = await bulkApiGetRecords<BulkJobResultRecord>(selectedOrg, jobInfo.id, batch.id, 'result');
        // this should match, but will fallback to batchIndex if for some reason we cannot find the batch
        const batchSummaryItem = batchSummary.batchSummary.find((item) => item.id === batch.id) ?? batchSummary.batchSummary[batchIndex];
        /**
         * Get records from this one batch. Batches are capped by record count AND by CSV size, so an
         * oversized batch gets split — the record range comes from the batch summary rather than
         * `batchNumber * batchSize`, which is only correct when no batch was split.
         */
        const startIdx = batchSummaryItem?.startIndex ?? batchIndex * batchSize;
        const recordCount = batchSummaryItem?.recordCount ?? batchSize;
        // Same alignment rule as the 'all' scope so both downloads pair results with the same source
        // records — an unconditional Id filter here would shift every row when Salesforce DID return
        // a result for an Id-less record.
        records = alignBatchSourceRecordsToResults([preparedData.data.slice(startIdx, startIdx + recordCount)], results.length, isDelete);
      }

      const combinedResults: any[] = [];

      results.forEach((resultRecord, i) => {
        // show all if results, otherwise just include errors
        if (type === 'results' || !resultRecord.Success) {
          const resultRow = buildBulkResultRow(resultRecord, records[i]);
          registerRetryRecord(resultRow, records[i]);
          combinedResults.push(resultRow);
        }
      });
      logger.debug({ combinedResults, results });
      const header = getLoadResultsHeader(getFieldHeaderFromMapping(fieldMapping));
      if (action === 'view') {
        setResultsModalData({ ...downloadModalData, open: true, header, data: combinedResults, type });
        trackEvent(ANALYTICS_KEYS.load_DownloadRecords, { loadType, type, numRows: combinedResults.length, scope });
      } else {
        setDownloadModalData({
          ...downloadModalData,
          open: true,
          fileNameParts: [loadType.toLocaleLowerCase(), selectedSObject.toLocaleLowerCase(), type],
          header,
          data: combinedResults,
        });
        trackEvent(ANALYTICS_KEYS.load_ViewRecords, { loadType, type, numRows: combinedResults.length, scope });
      }

      if (removedBatches) {
        fireToast({
          message: 'One or more batches were not successful and will not be included in the results.',
          type: 'warning',
        });
      }
    } catch (ex) {
      logger.warn(ex);
      setDownloadError(getErrorMessage(ex));
    } finally {
      setDownloadState(null);
    }
  }

  function handleDownloadProcessingErrors() {
    if (!preparedData) {
      return;
    }
    const header = getLoadResultsHeader(getFieldHeaderFromMapping(fieldMapping));
    setDownloadModalData({
      ...downloadModalData,
      open: true,
      fileNameParts: [loadType.toLocaleLowerCase(), selectedSObject.toLocaleLowerCase(), 'processing-failures'],
      header,
      data: preparedData.errors.map((error) => ({
        _id: null,
        _success: false,
        _errors: error.errors.join('\n'),
        ...error.record,
      })),
    });
  }

  function handleDownloadRecordsFromModal(type: 'results' | 'failures', rows: any[]) {
    const fields = getFieldHeaderFromMapping(fieldMapping);
    const header = getLoadResultsHeader(fields);
    setResultsModalData({ ...resultsModalData, open: false });
    setDownloadModalData({
      open: true,
      data: rows,
      header,
      fileNameParts: [loadType.toLocaleLowerCase(), selectedSObject.toLocaleLowerCase(), type],
    });
    trackEvent(ANALYTICS_KEYS.load_DownloadRecords, { loadType, type, numRows: rows.length, location: 'fromViewModal' });
  }

  function handleModalClose() {
    setDownloadModalData({ ...downloadModalData, open: false, fileNameParts: [] });
  }

  function handleViewModalClose() {
    setResultsModalData({ open: false, data: [], header: [], type: 'results' });
  }

  async function handleAbort() {
    isAborted.current = true;
    setStatus(STATUSES.ABORTING);
    try {
      jobInfo?.id && (await bulkApiAbortJob(selectedOrg, jobInfo.id));
    } catch (ex) {
      logger.warn(ex);
      fireToast({
        message: 'There was an error aborting the load.',
        type: 'error',
      });
    }
  }

  return (
    <div>
      {downloadModalData.open && (
        <FileDownloadModal
          org={selectedOrg}
          googleIntegrationEnabled={hasGoogleDriveAccess}
          googleShowUpgradeToPro={googleShowUpgradeToPro}
          google_apiKey={google_apiKey}
          google_appId={google_appId}
          google_clientId={google_clientId}
          data={downloadModalData.data}
          header={downloadModalData.header}
          fileNameParts={downloadModalData.fileNameParts}
          onModalClose={handleModalClose}
          emitUploadToGoogleEvent={fromJetstreamEvents.emit}
          source="load_records_results"
          trackEvent={trackEvent}
        />
      )}
      {resultsModalData.open && (
        <LoadRecordsResultsModal
          org={selectedOrg}
          type={resultsModalData.type}
          header={resultsModalData.header}
          rows={resultsModalData.data}
          selectable={resultsModalData.type === 'failures' && !!onRetrySelected}
          onRetrySelected={
            onRetrySelected
              ? (selectedRows) => {
                  // Recover the original prepared records — rows without a registered original are skipped
                  const preparedRecords = extractRetryRecords(selectedRows);
                  if (preparedRecords.length !== selectedRows.length) {
                    logger.warn('Some selected rows were missing their original prepared record and will be skipped for retry', {
                      selected: selectedRows.length,
                      recovered: preparedRecords.length,
                    });
                  }
                  if (preparedRecords.length > 0) {
                    onRetrySelected(preparedRecords);
                    handleViewModalClose();
                  }
                }
              : undefined
          }
          onDownload={handleDownloadRecordsFromModal}
          onClose={handleViewModalClose}
        />
      )}
      <Grid verticalAlign="center" align="spread">
        <div>
          {/* The status heading changes in place as the load progresses ("Uploading batch X of Y") — mirror it
              into a persistent live region (a live-region role on the heading itself removed its heading semantics) */}
          <AssistiveStatus message={`${status} ${getUploadingText() || ''}`.trim()} />
          <h3 className="slds-text-heading_small slds-grid">
            <Grid verticalAlign="center">
              <span className="slds-m-right_x-small">
                {status} <span className="slds-text-title">{getUploadingText()}</span>
              </span>
              {status === STATUSES.PREPARING && (
                <div>
                  {!!prepareDataProgress && (
                    <ProgressRing
                      className="slds-m-right_x-small"
                      fillPercent={prepareDataProgress / 100}
                      size="medium"
                      theme="active-step"
                    ></ProgressRing>
                  )}
                  <div
                    css={css`
                      width: 20px;
                      display: inline-block;
                    `}
                  >
                    <Spinner inline containerClassName="slds-m-bottom_x-small" size="x-small" />
                  </div>
                </div>
              )}
            </Grid>
          </h3>
          {fatalError && (
            <div className="slds-text-color_error" role="alert">
              <strong>Fatal Error</strong>: {fatalError}
            </div>
          )}
          {downloadError && (
            <div className="slds-text-color_error" role="alert">
              <strong>Error preparing data</strong>: {downloadError}
            </div>
          )}
          {batchSummary && (
            <SalesforceLogin
              serverUrl={serverUrl}
              org={selectedOrg}
              skipFrontDoorAuth={skipFrontDoorAuth}
              returnUrl={`/lightning/setup/AsyncApiJobStatus/page?address=%2F${batchSummary.jobInfo.id}`}
              iconPosition="right"
            >
              View job in Salesforce
            </SalesforceLogin>
          )}
        </div>
        <div>
          {ABORTABLE_STATUSES.has(status) && (
            <Tooltip content="Any batches in progress may not be able to be aborted.">
              {/* Stays focusable while its own click disables it — native disabled would drop focus to <body> */}
              <button
                className="slds-button slds-button_text-destructive slds-m-bottom_xx-small slds-is-relative"
                {...ariaDisabledButtonProps(status === STATUSES.ABORTING, () => handleAbort())}
              >
                {status === STATUSES.ABORTING && <Spinner size="small" />}
                Abort Job
              </button>
            </Tooltip>
          )}
          {status === STATUSES.FINISHED && (
            <div className="slds-is-relative">
              {downloadState === 'all' && <Spinner size="small" />}
              <ButtonGroupContainer className="slds-m-bottom_xx-small">
                {onRetryAll && (failedRecordCount ?? 0) > 0 && (
                  <button className="slds-button slds-button_neutral" onClick={onRetryAll}>
                    <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" omitContainer />
                    Retry Failed Records ({formatNumber(failedRecordCount)})
                  </button>
                )}
                {batchSummary && batchSummary.totalBatches > 1 && (
                  <>
                    {/* Both stay focusable while their own click disables them — native disabled would drop focus to <body> */}
                    <button
                      className="slds-button slds-button_neutral"
                      {...ariaDisabledButtonProps(!!downloadState, () =>
                        handleDownloadOrViewRecords({
                          scope: 'all',
                          action: 'download',
                          type: 'results',
                        }),
                      )}
                    >
                      <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
                      Download All
                    </button>
                    <button
                      className="slds-button slds-button_neutral"
                      {...ariaDisabledButtonProps(!!downloadState, () =>
                        handleDownloadOrViewRecords({
                          scope: 'all',
                          action: 'view',
                          type: 'results',
                        }),
                      )}
                    >
                      <Icon type="utility" icon="preview" className="slds-button__icon slds-button__icon_left" omitContainer />
                      View All
                    </button>
                  </>
                )}
              </ButtonGroupContainer>
            </div>
          )}
        </div>
      </Grid>
      {autoSplitBatchCount > 0 && (
        <ScopedNotification theme="info" className="slds-m-vertical_x-small" allowClose>
          Some of your batches were larger than Salesforce allows, so they were automatically split into smaller batches.
        </ScopedNotification>
      )}
      {pollingTimedOut && (
        <ScopedNotification theme="warning" className="slds-m-vertical_x-small">
          <Grid verticalAlign="center" align="spread" wrap>
            <span className="slds-m-right_small">
              Jetstream stopped checking the status of this job because it has been running for a long time. The job continues in Salesforce
              regardless - resume checking to pick up the latest status.
            </span>
            <button className="slds-button slds-button_neutral" onClick={handleResumePolling}>
              <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" omitContainer />
              Resume checking status
            </button>
          </Grid>
        </ScopedNotification>
      )}
      {/* Data is being processed */}
      {jobInfo && preparedData && (
        <LoadRecordsBulkApiResultsTable
          jobInfo={jobInfo}
          processingErrors={preparedData.errors}
          processingStartTime={processingStartTime}
          processingEndTime={processingEndTime}
          onDownloadOrView={handleDownloadOrViewRecords}
          onDownloadProcessingErrors={handleDownloadProcessingErrors}
        />
      )}
    </div>
  );
};

export default LoadRecordsBulkApiResults;
