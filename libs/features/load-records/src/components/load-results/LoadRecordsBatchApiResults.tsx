import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { convertDateToLocale, useBrowserNotifications, useRollbar } from '@jetstream/shared/ui-utils';
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
import { FileDownloadModal, Grid, ProgressRing, Spinner, Tooltip } from '@jetstream/ui';
import {
  LoadRecordsResultsModal,
  applicationCookieState,
  fromJetstreamEvents,
  getFieldHeaderFromMapping,
  useAmplitude,
} from '@jetstream/ui-core';
import { FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';
import { loadBatchApiData, prepareData } from '../../utils/load-records-process';
import LoadRecordsBatchApiResultsTable from './LoadRecordsBatchApiResultsTable';

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
  onFinish: (results: { success: number; failure: number }) => void;
}

export const LoadRecordsBatchApiResults: FunctionComponent<LoadRecordsBatchApiResultsProps> = ({
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
  onFinish,
}) => {
  const isMounted = useRef(true);
  const isAborted = useRef(false);
  const { trackEvent } = useAmplitude();
  const rollbar = useRollbar();
  const processingStatusRef = useRef<{ success: number; failure: number }>({ success: 0, failure: 0 });
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
  const [{ serverUrl, google_apiKey, google_appId, google_clientId }] = useRecoilState(applicationCookieState);
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
        setPreparedData(preparedData);
        setProcessingEndTime(dateString);
        setStartTime(dateString);
        setEndTime(dateString);
        onFinish({ success: 0, failure: inputFileData.length });
        notifyUser(`Your ${loadType.toLowerCase()} data load failed`, {
          body: `❌ Pre-processing records failed.`,
          tag: 'load-records',
        });
        rollbar.error('Error preparing batch api data', {
          message: 'Pre-processing failed',
          queryErrors: preparedData?.queryErrors,
          errors: preparedDataResponse.errors?.flatMap((error) => error.errors) || [],
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
      onFinish({ success: 0, failure: inputFileData.length });
      notifyUser(`Your ${loadType.toLowerCase()} data load failed`, {
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
          setProcessedRecords((previousProcessedRecords) => previousProcessedRecords.concat(records || []));
        },
        () => isAborted.current
      );

      const dateString = convertDateToLocale(new Date(), { timeStyle: 'medium' });

      setStatus(STATUSES.FINISHED);
      onFinish({ success: processingStatusRef.current.success, failure: processingStatusRef.current.failure });
      setEndTime(dateString);
    } catch (ex) {
      const dateString = convertDateToLocale(new Date(), { timeStyle: 'medium' });
      logger.error('ERROR', ex);
      setStatus(STATUSES.ERROR);
      onFinish({ success: 0, failure: inputFileData.length });
      setEndTime(dateString);
      notifyUser(`Your ${loadType.toLowerCase()} data load failed`, {
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
      notifyUser(`Your ${loadType.toLowerCase()} data load is finished`, {
        body: `${getSuccessOrFailureChar('success', numSuccess)} ${numSuccess.toLocaleString()} ${pluralizeFromNumber(
          'record',
          numSuccess
        )} loaded successfully ${getSuccessOrFailureChar('failure', numFailure)} ${numFailure.toLocaleString()} ${pluralizeFromNumber(
          'record',
          numFailure
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
        combinedResults.push({
          _id: record.success ? record.id : (record as any)['Id'] || '',
          _success: record.success,
          _errors:
            record.success === false
              ? record.errors.map((error) => `${error.statusCode}: ${decodeHtmlEntity(error.message)}`).join('\n')
              : '',
          ...flattenRecord(record.record, fields),
        });
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
        combinedResults.push({
          _id: record.success ? record.id : (record as any)['Id'] || '',
          _success: record.success,
          _errors:
            record.success === false
              ? record.errors.map((error) => `${error.statusCode}: ${decodeHtmlEntity(error.message)}`).join('\n')
              : '',
          ...flattenRecord(record.record, fields),
        });
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
          google_apiKey={google_apiKey}
          google_appId={google_appId}
          google_clientId={google_clientId}
          data={downloadModalData.data}
          header={downloadModalData.header}
          fileNameParts={downloadModalData.fileNameParts}
          onModalClose={handleDownloadModalClose}
          emitUploadToGoogleEvent={fromJetstreamEvents.emit}
        />
      )}
      {resultsModalData.open && (
        <LoadRecordsResultsModal
          org={selectedOrg}
          type={resultsModalData.type}
          header={resultsModalData.header}
          rows={resultsModalData.data}
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
