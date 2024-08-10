import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { bulkApiAbortJob, bulkApiGetJob, bulkApiGetRecords } from '@jetstream/shared/data';
import { checkIfBulkApiJobIsDone, convertDateToLocale, useBrowserNotifications, useRollbar } from '@jetstream/shared/ui-utils';
import {
  decodeHtmlEntity,
  getErrorMessage,
  getErrorMessageAndStackObj,
  getSuccessOrFailureChar,
  pluralizeFromNumber,
} from '@jetstream/shared/utils';
import {
  ApiMode,
  BulkJobBatchInfo,
  BulkJobResultRecord,
  BulkJobWithBatches,
  DownloadAction,
  DownloadModalData,
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
import { FileDownloadModal, Grid, ProgressRing, SalesforceLogin, Spinner, Tooltip, fireToast } from '@jetstream/ui';
import {
  LoadRecordsBulkApiResultsTable,
  LoadRecordsResultsModal,
  applicationCookieState,
  fromJetstreamEvents,
  getFieldHeaderFromMapping,
  selectSkipFrontdoorAuth,
  useAmplitude,
} from '@jetstream/ui-core';
import { FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilValue } from 'recoil';
import { loadBulkApiData, prepareData } from '../../utils/load-records-process';

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

const CHECK_INTERVAL = 3000;
const MAX_INTERVAL_CHECK_COUNT = 200; // 3000*200/60=10 minutes
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
  onFinish: (results: { success: number; failure: number }) => void;
}

export const LoadRecordsBulkApiResults: FunctionComponent<LoadRecordsBulkApiResultsProps> = ({
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
  const { serverUrl, google_apiKey, google_appId, google_clientId } = useRecoilValue(applicationCookieState);
  const skipFrontDoorAuth = useRecoilValue(selectSkipFrontdoorAuth);
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
  const [downloadModalData, setDownloadModalData] = useState<DownloadModalData>({
    open: false,
    data: [],
    header: [],
    fileNameParts: [],
  });
  const [resultsModalData, setResultsModalData] = useState<ViewModalData>({ open: false, data: [], header: [], type: 'results' });
  const { notifyUser } = useBrowserNotifications(serverUrl);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

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
          }, {})
        );
      }
    }
  }, [batchSummary]);

  /**
   * When jobInfo is modified, check to see if everything is done
   * If not done and status is processing, then continue polling
   */
  useEffect(() => {
    if (jobInfo && status !== STATUSES.ERROR && status !== STATUSES.FINISHED && batchSummary && preparedData) {
      const isDone = checkIfBulkApiJobIsDone(jobInfo, batchSummary.totalBatches);
      if (isDone) {
        setStatus(STATUSES.FINISHED);
        const numSuccess = jobInfo.numberRecordsProcessed - jobInfo.numberRecordsFailed;
        const numFailure = jobInfo.numberRecordsFailed + preparedData.errors.length;
        onFinish({ success: numSuccess, failure: numFailure });
        notifyUser(`Your ${jobInfo.operation} data load is finished`, {
          body: `${getSuccessOrFailureChar('success', numSuccess)} ${numSuccess.toLocaleString()} ${pluralizeFromNumber(
            'record',
            numSuccess
          )} loaded successfully - ${getSuccessOrFailureChar('failure', numFailure)} ${numFailure.toLocaleString()} ${pluralizeFromNumber(
            'record',
            numFailure
          )} failed`,
          tag: 'load-records',
        });
      } else if (status === STATUSES.PROCESSING && intervalCount < MAX_INTERVAL_CHECK_COUNT) {
        // we need to wait until all data is uploaded?
        setTimeout(async () => {
          if (!isMounted.current || !batchIdByIndex || !jobInfo.id) {
            return;
          }
          const jobInfoWithBatches = await bulkApiGetJob(selectedOrg, jobInfo.id);
          if (!isMounted.current) {
            return;
          }
          // jobInfoWithBatches.batches = orderBy(jobInfoWithBatches.batches, ['createdDate']);
          const batches: BulkJobBatchInfo[] = [];
          // re-order (if needed)
          jobInfoWithBatches.batches.forEach((batch) => {
            batches[batchIdByIndex[batch.id]] = batch;
          });
          jobInfoWithBatches.batches = batches;
          setJobInfo(jobInfoWithBatches);
          setIntervalCount(intervalCount + 1);
        }, CHECK_INTERVAL);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobInfo, status]);

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
        // processing failed on every record
        setStatus(STATUSES.ERROR);
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
        onFinish({ success: 0, failure: inputFileData.length });
        notifyUser(`Your ${loadType.toLowerCase()} data load failed`, {
          body: `❌ Pre-processing records failed.`,
          tag: 'load-records',
        });
        rollbar.error('Error preparing bulk api data', { queryErrors: preparedDataResponse?.queryErrors });
      } else {
        setStatus(STATUSES.UPLOADING);
        setPreparedData(preparedDataResponse);
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
      rollbar.error('Error preparing bulk api data', getErrorMessageAndStackObj(ex));
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
            setJobInfo(resultsSummary.jobInfo);
          }
        },
        () => isAborted.current
      );

      if (loadError) {
        logger.error('ERROR', loadError);
        setFatalError(loadError.message);
        if (jobInfo && jobInfo.batches.length) {
          setJobInfo(jobInfo);
          setStatus(STATUSES.PROCESSING);
        } else {
          setStatus(STATUSES.ERROR);
          onFinish({ success: 0, failure: inputFileData.length });
          notifyUser(`Your data load failed`, {
            body: `❌ ${loadError.message}`,
            tag: 'load-records',
          });
        }
        rollbar.error('Error loading batches', {
          message: loadError.message,
          stack: loadError.stack,
          specificErrors: loadError.additionalErrors.map((error) => ({
            message: error.message,
            stack: error.stack,
          })),
        });
      } else {
        setJobInfo(jobInfo);
        setStatus(STATUSES.PROCESSING);
      }
    } catch (ex) {
      logger.error('ERROR', ex);
      setFatalError(getErrorMessage(ex));
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
    return `Uploading batch ${batchSummary.batchSummary.filter((item) => item.completed).length + 1} of ${batchSummary.totalBatches}`;
  }

  async function handleDownloadOrViewRecords(
    action: DownloadAction,
    type: DownloadType,
    batch: BulkJobBatchInfo,
    batchIndex: number
  ): Promise<void> {
    try {
      if (!batchSummary || !jobInfo?.id || !preparedData) {
        return;
      }
      if (downloadError) {
        setDownloadError(null);
      }
      // download records, combine results from salesforce with actual records, open download modal
      const results = await bulkApiGetRecords<BulkJobResultRecord>(selectedOrg, jobInfo.id, batch.id, 'result');
      // this should match, but will fallback to batchIndex if for some reason we cannot find the batch
      const batchSummaryItem = batchSummary.batchSummary.find((item) => item.id === batch.id);
      const startIdx = (batchSummaryItem?.batchNumber ?? batchIndex) * batchSize;
      /** For delete, only records with a mapped Id will be included in response from SFDC */
      const records: any[] = preparedData.data
        .slice(startIdx, startIdx + batchSize)
        .filter((record) => (loadType !== 'DELETE' ? true : !!record.Id));
      const combinedResults: BulkJobResultRecord[] = [];

      results.forEach((resultRecord, i) => {
        // show all if results, otherwise just include errors
        if (type === 'results' || !resultRecord.Success) {
          combinedResults.push({
            _id: resultRecord.Id || records[i].Id || null,
            _success: resultRecord.Success,
            _errors: decodeHtmlEntity(resultRecord.Error),
            ...records[i],
          });
        }
      });
      logger.log({ combinedResults });
      const header = ['_id', '_success', '_errors'].concat(getFieldHeaderFromMapping(fieldMapping));
      if (action === 'view') {
        setResultsModalData({ ...downloadModalData, open: true, header, data: combinedResults, type });
        trackEvent(ANALYTICS_KEYS.load_DownloadRecords, { loadType, type, numRows: combinedResults.length });
      } else {
        setDownloadModalData({
          ...downloadModalData,
          open: true,
          fileNameParts: [loadType.toLocaleLowerCase(), selectedSObject.toLocaleLowerCase(), type],
          header,
          data: combinedResults,
        });
        trackEvent(ANALYTICS_KEYS.load_ViewRecords, { loadType, type, numRows: combinedResults.length });
      }
    } catch (ex) {
      logger.warn(ex);
      setDownloadError(getErrorMessage(ex));
    }
  }

  function handleDownloadProcessingErrors() {
    if (!preparedData) {
      return;
    }
    const header = ['_id', '_success', '_errors'].concat(getFieldHeaderFromMapping(fieldMapping));
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
          google_apiKey={google_apiKey}
          google_appId={google_appId}
          google_clientId={google_clientId}
          data={downloadModalData.data}
          header={downloadModalData.header}
          fileNameParts={downloadModalData.fileNameParts}
          onModalClose={handleModalClose}
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
            <div className="slds-text-color_error">
              <strong>Fatal Error</strong>: {fatalError}
            </div>
          )}
          {downloadError && (
            <div className="slds-text-color_error">
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
