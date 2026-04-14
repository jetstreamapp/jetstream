import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { convertDateToLocale, formatNumber, useBrowserNotifications, useRollbar } from '@jetstream/shared/ui-utils';
import {
  decodeHtmlEntity,
  flattenRecord,
  getErrorMessage,
  getErrorMessageAndStackObj,
  getSuccessOrFailureChar,
  pluralizeFromNumber,
} from '@jetstream/shared/utils';
import {
  ApiMode,
  DownloadModalData,
  FieldMapping,
  InsertUpdateUpsertDelete,
  LoadDataBatchApiProgress,
  LoadDataPayload,
  Maybe,
  PrepareDataPayload,
  PrepareDataResponse,
  RecordResultWithRecord,
  SalesforceOrgUi,
  ViewModalData,
} from '@jetstream/types';
import { FileDownloadModal, Grid, Icon, ProgressRing, Spinner, Tooltip } from '@jetstream/ui';
import { fromJetstreamEvents, getFieldHeaderFromMapping, LoadRecordsResultsModal, useAmplitude } from '@jetstream/ui-core';
import { applicationCookieState, googleDriveAccessState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { useCallback, useEffect, useRef, useState } from 'react';
import { loadBatchApiData, LoadTypeDisplayNames, prepareData } from '../../utils/load-records-process';
import LoadRecordsBatchApiResultsTable from './LoadRecordsBatchApiResultsTable';
import { extractRetryRecords, registerRetryRecord } from './retry-record-map';

type Status = 'Preparing Data' | 'Processing Data' | 'Aborting' | 'Finished' | 'Error';

const STATUSES: {
  PREPARING: Status;
  PROCESSING: Status;
  ABORTING: Status;
  FINISHED: Status;
  ERROR: Status;
} = {
  PREPARING: 'Preparing Data',
  PROCESSING: 'Processing Data',
  ABORTING: 'Aborting',
  FINISHED: 'Finished',
  ERROR: 'Error',
};

const ABORTABLE_STATUSES = new Set<Status>([STATUSES.PREPARING, STATUSES.PROCESSING, STATUSES.ABORTING]);

export interface LoadRecordsBatchApiResultsProps {
  selectedOrg: SalesforceOrgUi;
  selectedSObject: string;
  fieldMapping: FieldMapping;
  inputFileData: any[];
  inputZipFileData: Maybe<ArrayBuffer>;
  apiMode: ApiMode;
  loadType: InsertUpdateUpsertDelete;
  externalId?: string;
  batchSize: number;
  insertNulls: boolean;
  assignmentRuleId?: Maybe<string>;
  serialMode: boolean;
  dateFormat: string;
  /** Already-prepared records for retry — skips prepareData when provided */
  preparedInputData?: any[];
  onFinish: (results: { success: number; failure: number; failedRecords: any[] }) => void;
  /** Called when user selects specific records to retry from the results modal */
  onRetrySelected?: (selectedRows: any[]) => void;
  /** Called to retry all failed records from this run */
  onRetryAll?: () => void;
  /** Number of failed records available for retry — used for button label */
  failedRecordCount?: number;
}

export const LoadRecordsBatchApiResults = ({
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
  onFinish,
  onRetrySelected,
  onRetryAll,
  failedRecordCount,
}: LoadRecordsBatchApiResultsProps) => {
  const isMounted = useRef(true);
  const isAborted = useRef(false);
  // Ref to avoid stale closures in stable useCallback/useEffect — always call onFinishRef.current
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  const { trackEvent } = useAmplitude();
  const rollbar = useRollbar();
  const processingStatusRef = useRef<{ success: number; failure: number }>({ success: 0, failure: 0 });
  const processedRecordsRef = useRef<RecordResultWithRecord[]>([]);
  const [preparedData, setPreparedData] = useState<PrepareDataResponse>();
  const [prepareDataProgress, setPrepareDataProgress] = useState(0);
  const [status, setStatus] = useState<Status>(STATUSES.PREPARING);
  const [fatalError, setFatalError] = useState<string | null>(null);
  const [processingStartTime, setProcessingStartTime] = useState<Maybe<string>>(null);
  const [processingEndTime, setProcessingEndTime] = useState<Maybe<string>>(null);
  const [startTime, setStartTime] = useState<Maybe<string>>(null);
  const [endTime, setEndTime] = useState<Maybe<string>>(null);
  const [processedRecords, setProcessedRecords] = useState<RecordResultWithRecord[]>([]);
  const [processingStatus, setProcessingStatus] = useState<LoadDataBatchApiProgress>({
    total: 0,
    success: 0,
    failure: 0,
  });
  const [downloadModalData, setDownloadModalData] = useState<DownloadModalData>({ open: false, data: [], header: [], fileNameParts: [] });
  const [resultsModalData, setResultsModalData] = useState<ViewModalData>({ open: false, data: [], header: [], type: 'results' });
  const { serverUrl, google_apiKey, google_appId, google_clientId } = useAtomValue(applicationCookieState);
  const { hasGoogleDriveAccess, googleShowUpgradeToPro } = useAtomValue(googleDriveAccessState);
  const { notifyUser } = useBrowserNotifications(serverUrl);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

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
        setStatus(STATUSES.PROCESSING);
        setPreparedData(preparedDataResponse);
        setStartTime(dateString);
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
        if (preparedDataResponse?.queryErrors?.length) {
          setFatalError(preparedDataResponse.queryErrors.join('\n'));
        }

        setStatus(STATUSES.ERROR);
        setPreparedData(preparedDataResponse);
        setProcessingEndTime(dateString);
        setStartTime(dateString);
        setEndTime(dateString);
        onFinishRef.current({ success: 0, failure: inputFileData.length, failedRecords: [] });
        notifyUser(`Your ${LoadTypeDisplayNames[loadType]} data load failed`, {
          body: `❌ Pre-processing records failed.`,
          tag: 'load-records',
        });
      } else {
        setStatus(STATUSES.PROCESSING);
        setPreparedData(preparedDataResponse);
        setStartTime(dateString);
        setProcessingEndTime(dateString);

        return preparedDataResponse;
      }
    } catch (ex) {
      logger.error('ERROR', ex);
      setStatus(STATUSES.ERROR);
      setFatalError(getErrorMessage(ex));
      onFinishRef.current({ success: 0, failure: inputFileData.length, failedRecords: [] });
      notifyUser(`Your ${LoadTypeDisplayNames[loadType]} data load failed`, {
        body: `❌ ${getErrorMessage(ex)}`,
        tag: 'load-records',
      });
      rollbar.error('Error preparing batch api data', getErrorMessageAndStackObj(ex));
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

    try {
      const loadDataPayload: LoadDataPayload = {
        org: selectedOrg,
        data: preparedDataResponse.data,
        sObject: selectedSObject,
        apiMode,
        type: loadType,
        batchSize,
        assignmentRuleId,
        serialMode,
        externalId,
        binaryBodyField: Object.values(fieldMapping).find((field) => field.isBinaryBodyField)?.targetField,
        zipData: inputZipFileData,
      };

      await loadBatchApiData(
        loadDataPayload,
        (records) => {
          const batchRecords = records || [];
          if (!batchRecords.length) {
            return;
          }
          // Mutate the ref array (O(n) total) instead of reallocating the full accumulated array
          // on every batch via concat (O(n^2) total) — matters for large loads.
          processedRecordsRef.current.push(...batchRecords);
          setProcessedRecords((previousProcessedRecords) => previousProcessedRecords.concat(batchRecords));
        },
        () => isAborted.current,
      );

      const dateString = convertDateToLocale(new Date(), { timeStyle: 'medium' });
      const failedRecords = processedRecordsRef.current.filter((record) => !record.success).map((record) => record.record);
      // Compute counts directly from the ref — processingStatusRef may be stale since it's updated in a useEffect
      const successCount = processedRecordsRef.current.filter((record) => record.success).length;
      const prepareFailureCount = preparedDataResponse.errors.length;
      const failureCount = processedRecordsRef.current.length - successCount + prepareFailureCount;

      setStatus(STATUSES.FINISHED);
      onFinishRef.current({ success: successCount, failure: failureCount, failedRecords });
      setEndTime(dateString);
    } catch (ex) {
      const dateString = convertDateToLocale(new Date(), { timeStyle: 'medium' });
      logger.error('ERROR', ex);
      setStatus(STATUSES.ERROR);
      onFinishRef.current({ success: 0, failure: inputFileData.length, failedRecords: [] });
      setEndTime(dateString);
      notifyUser(`Your ${LoadTypeDisplayNames[loadType]} data load failed`, {
        body: `❌ ${getErrorMessage(ex)}`,
        tag: 'load-records',
      });
      rollbar.error('Error loading batches', getErrorMessageAndStackObj(ex));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (Array.isArray(processedRecords) && processedRecords.length > 0) {
      processingStatusRef.current.success = processedRecords.filter((record) => record.success).length;
      processingStatusRef.current.failure = processedRecords.filter((record) => !record.success).length;
      setProcessingStatus({
        total: preparedData?.data.length || 0,
        success: processingStatusRef.current.success,
        failure: processingStatusRef.current.failure,
      });
    }
  }, [preparedData, processedRecords]);

  useEffect(() => {
    if (status === STATUSES.FINISHED && preparedData) {
      const numSuccess = processingStatus.success;
      const numFailure = processingStatus.failure + preparedData.errors.length;
      notifyUser(`Your ${LoadTypeDisplayNames[loadType]} data load is finished`, {
        body: `${getSuccessOrFailureChar('success', numSuccess)} ${numSuccess.toLocaleString()} ${pluralizeFromNumber(
          'record',
          numSuccess,
        )} loaded successfully ${getSuccessOrFailureChar('failure', numFailure)} ${numFailure.toLocaleString()} ${pluralizeFromNumber(
          'record',
          numFailure,
        )} failed`,
        tag: 'load-records',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, processingStatus, preparedData]);

  function handleDownloadRecords(type: 'results' | 'failures') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const combinedResults: any[] = [];
    // Use field mapping to determine headers in output data and account for relationship fields
    const fields = getFieldHeaderFromMapping(fieldMapping);

    processedRecords.forEach((record) => {
      if (type === 'results' ? true : !record.success) {
        const resultRow = {
          _id: record.success ? record.id : (record as any)['Id'] || '',
          _success: record.success,
          _errors:
            record.success === false
              ? record.errors.map((error) => `${error.statusCode}: ${decodeHtmlEntity(error.message)}`).join('\n')
              : '',
          ...flattenRecord(record.record, fields),
        };
        registerRetryRecord(resultRow, record.record);
        combinedResults.push(resultRow);
      }
    });

    const header = ['_id', '_success', '_errors'].concat(fields);
    setDownloadModalData({
      open: true,
      data: combinedResults,
      header,
      fileNameParts: [loadType.toLocaleLowerCase(), selectedSObject.toLocaleLowerCase(), type],
    });
    trackEvent(ANALYTICS_KEYS.load_DownloadRecords, { loadType, type, numRows: combinedResults.length });
  }

  function handleViewRecords(type: 'results' | 'failures') {
    const combinedResults: any[] = [];
    // Use field mapping to determine headers in output data and account for relationship fields
    const fields = getFieldHeaderFromMapping(fieldMapping);

    processedRecords.forEach((record) => {
      if (type === 'results' ? true : !record.success) {
        const resultRow = {
          _id: record.success ? record.id : (record as any)['Id'] || '',
          _success: record.success,
          _errors:
            record.success === false
              ? record.errors.map((error) => `${error.statusCode}: ${decodeHtmlEntity(error.message)}`).join('\n')
              : '',
          ...flattenRecord(record.record, fields),
        };
        // Register the unflattened prepared record so "Retry Selected" from the view modal
        // can recover the correct payload (flattenRecord JSON-stringifies nested objects).
        registerRetryRecord(resultRow, record.record);
        combinedResults.push(resultRow);
      }
    });

    const header = ['_id', '_success', '_errors'].concat(fields);
    setResultsModalData({
      open: true,
      data: combinedResults,
      header,
      type,
    });
    trackEvent(ANALYTICS_KEYS.load_ViewRecords, { loadType, type, numRows: combinedResults.length });
  }

  function handleDownloadRecordsFromModal(type: 'results' | 'failures', rows: any[]) {
    const fields = getFieldHeaderFromMapping(fieldMapping);
    const header = ['_id', '_success', '_errors'].concat(fields);
    setResultsModalData({ ...resultsModalData, open: false });
    setDownloadModalData({
      open: true,
      data: rows,
      header,
      fileNameParts: [loadType.toLocaleLowerCase(), selectedSObject.toLocaleLowerCase(), type],
    });
    trackEvent(ANALYTICS_KEYS.load_DownloadRecords, { loadType, type, numRows: rows.length, location: 'fromViewModal' });
  }

  function handleDownloadProcessingErrors() {
    const fields = getFieldHeaderFromMapping(fieldMapping);
    const header = ['_id', '_success', '_errors'].concat(fields);
    setDownloadModalData({
      ...downloadModalData,
      open: true,
      fileNameParts: [loadType.toLocaleLowerCase(), selectedSObject.toLocaleLowerCase(), 'processing-failures'],
      header,
      data:
        preparedData?.errors.map((error) => ({
          _id: null,
          _success: false,
          _errors: error.errors.join('\n'),
          ...flattenRecord(error.record, fields),
        })) || [],
    });
  }

  function handleDownloadModalClose() {
    setDownloadModalData({ open: false, data: [], header: [], fileNameParts: [] });
  }

  function handleViewModalClose() {
    setResultsModalData({ open: false, data: [], header: [], type: 'results' });
  }

  function handleAbort() {
    isAborted.current = true;
    setStatus(STATUSES.ABORTING);
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
          onModalClose={handleDownloadModalClose}
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
          <h3 className="slds-text-heading_small">
            <Grid verticalAlign="center">
              <span className="slds-m-right_x-small">{status}</span>
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
            <div className="slds-text-color_error">
              <strong>Fatal Error</strong>: {fatalError}
            </div>
          )}
        </div>
        <div>
          {ABORTABLE_STATUSES.has(status) && (
            <Tooltip content="Any batches in progress may not be able to be aborted.">
              <button
                className="slds-button slds-button_text-destructive slds-m-bottom_xx-small slds-is-relative"
                disabled={status === STATUSES.ABORTING}
                onClick={handleAbort}
              >
                {status === STATUSES.ABORTING && <Spinner size="small" />}
                Abort Job
              </button>
            </Tooltip>
          )}
          {status === STATUSES.FINISHED && onRetryAll && (failedRecordCount ?? 0) > 0 && (
            <button className="slds-button slds-button_neutral slds-m-bottom_xx-small" onClick={onRetryAll}>
              <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" omitContainer />
              Retry Failed Records ({formatNumber(failedRecordCount)})
            </button>
          )}
        </div>
      </Grid>
      {/* Data is being processed */}
      {startTime && (
        <LoadRecordsBatchApiResultsTable
          processingErrors={preparedData?.errors}
          processingStatus={processingStatus}
          failedProcessingStage={!preparedData?.data.length && !!preparedData?.errors.length}
          inProgress={status === STATUSES.PROCESSING}
          failed={status === STATUSES.ERROR}
          startTime={startTime}
          endTime={endTime}
          processingStartTime={processingStartTime}
          processingEndTime={processingEndTime}
          onDownload={handleDownloadRecords}
          onViewResults={handleViewRecords}
          onDownloadProcessingErrors={handleDownloadProcessingErrors}
        />
      )}
    </div>
  );
};

export default LoadRecordsBatchApiResults;
