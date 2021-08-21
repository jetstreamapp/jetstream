/** @jsx jsx */
import { jsx } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { useBrowserNotifications } from '@jetstream/shared/ui-utils';
import { flattenRecord, getSuccessOrFailureChar, pluralizeFromNumber } from '@jetstream/shared/utils';
import { InsertUpdateUpsertDelete, RecordResultWithRecord, SalesforceOrgUi, WorkerMessage } from '@jetstream/types';
import { FileDownloadModal, Spinner } from '@jetstream/ui';
import { FunctionComponent, useEffect, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';
import { applicationCookieState } from '../../../../app-state';
import * as fromJetstreamEvents from '../../../core/jetstream-events';
import {
  ApiMode,
  FieldMapping,
  LoadDataBatchApiProgress,
  LoadDataPayload,
  PrepareDataPayload,
  PrepareDataResponse,
} from '../../load-records-types';
import LoadWorker from '../../load-records.worker';
import { getFieldHeaderFromMapping } from '../../utils/load-records-utils';
import LoadRecordsBatchApiResultsTable from './LoadRecordsBatchApiResultsTable';

type Status = 'Preparing Data' | 'Processing Data' | 'Finished' | 'Error';

const STATUSES: {
  PREPARING: Status;
  PROCESSING: Status;
  FINISHED: Status;
  ERROR: Status;
} = {
  PREPARING: 'Preparing Data',
  PROCESSING: 'Processing Data',
  FINISHED: 'Finished',
  ERROR: 'Error',
};

export interface LoadRecordsBatchApiResultsProps {
  selectedOrg: SalesforceOrgUi;
  selectedSObject: string;
  fieldMapping: FieldMapping;
  inputFileData: any[];
  apiMode: ApiMode;
  loadType: InsertUpdateUpsertDelete;
  externalId?: string;
  batchSize: number;
  insertNulls: boolean;
  assignmentRuleId?: string;
  serialMode: boolean;
  dateFormat: string;
  onFinish: (results: { success: number; failure: number }) => void;
}

export const LoadRecordsBatchApiResults: FunctionComponent<LoadRecordsBatchApiResultsProps> = ({
  selectedOrg,
  selectedSObject,
  fieldMapping,
  inputFileData,
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
  const isMounted = useRef(null);
  // used to ensure that data in the onworker callback gets a reference to the results
  const processingStatusRef = useRef<{ success: number; failure: number }>({ success: 0, failure: 0 });
  const [preparedData, setPreparedData] = useState<PrepareDataResponse>();
  const [loadWorker] = useState(() => new LoadWorker());
  const [status, setStatus] = useState<Status>(STATUSES.PREPARING);
  const [fatalError, setFatalError] = useState<string>(null);
  const [processingStartTime, setProcessingStartTime] = useState<string>(null);
  const [processingEndTime, setProcessingEndTime] = useState<string>(null);
  const [startTime, setStartTime] = useState<string>(null);
  const [endTime, setEndTime] = useState<string>(null);
  const [processedRecords, setProcessedRecords] = useState<RecordResultWithRecord[]>([]);
  const [processingStatus, setProcessingStatus] = useState<LoadDataBatchApiProgress>({
    total: 0,
    success: 0,
    failure: 0,
  });
  const [downloadModalData, setDownloadModalData] = useState({ open: false, data: [], header: [], fileNameParts: [] });
  const [{ serverUrl, google_apiKey, google_appId, google_clientId }] = useRecoilState(applicationCookieState);
  const { notifyUser } = useBrowserNotifications(serverUrl);

  useEffect(() => {
    isMounted.current = true;
    return () => (isMounted.current = false);
  }, []);

  useEffect(() => {
    if (loadWorker) {
      setStatus(STATUSES.PREPARING);
      setProcessingStartTime(new Date().toLocaleString());
      setFatalError(null);
      const data: PrepareDataPayload = {
        org: selectedOrg,
        data: inputFileData,
        fieldMapping,
        sObject: selectedSObject,
        insertNulls,
        dateFormat,
        apiMode,
      };
      loadWorker.postMessage({ name: 'prepareData', data: data });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadWorker]);

  useEffect(() => {
    if (preparedData && preparedData.data.length) {
      const data: LoadDataPayload = {
        org: selectedOrg,
        data: preparedData.data,
        sObject: selectedSObject,
        apiMode,
        type: loadType,
        batchSize,
        assignmentRuleId,
        serialMode,
        externalId,
      };
      loadWorker.postMessage({ name: 'loadData', data });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preparedData]);

  useEffect(() => {
    if (Array.isArray(processedRecords) && processedRecords.length > 0) {
      processingStatusRef.current.success = processedRecords.filter((record) => record.success).length;
      processingStatusRef.current.failure = processedRecords.filter((record) => !record.success).length;
      setProcessingStatus({
        total: preparedData.data.length,
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
  }, [status, processingStatus, preparedData]);

  useEffect(() => {
    if (loadWorker) {
      loadWorker.onmessage = (event: MessageEvent) => {
        if (!isMounted.current) {
          return;
        }
        const payload: WorkerMessage<
          'prepareData' | 'loadDataStatus' | 'loadData',
          { preparedData?: PrepareDataResponse; records?: RecordResultWithRecord[] }
        > = event.data;
        logger.log('[LOAD DATA]', payload.name, { payload });
        const dateString = new Date().toLocaleString();
        switch (payload.name) {
          case 'prepareData': {
            if (payload.error) {
              logger.error('ERROR', payload.error);
              setStatus(STATUSES.ERROR);
              setFatalError(payload.error.message);
              onFinish({ success: 0, failure: inputFileData.length });
              notifyUser(`Your ${loadType.toLowerCase()} data load failed`, {
                body: `❌ ${payload.error?.message || payload.error}`,
                tag: 'load-records',
              });
            } else if (!payload.data.preparedData.data.length) {
              if (payload.data.preparedData.queryErrors?.length) {
                setFatalError(payload.data.preparedData.queryErrors.join('\n'));
              }
              setStatus(STATUSES.ERROR);
              setPreparedData(payload.data.preparedData);
              setProcessingEndTime(dateString);
              setStartTime(dateString);
              setEndTime(dateString);
              onFinish({ success: 0, failure: inputFileData.length });
              notifyUser(`Your ${loadType.toLowerCase()} data load failed`, {
                body: `❌ Pre-processing records failed.`,
                tag: 'load-records',
              });
            } else {
              setStatus(STATUSES.PROCESSING);
              setPreparedData(payload.data.preparedData);
              setStartTime(dateString);
              setProcessingEndTime(dateString);
            }
            break;
          }
          case 'loadDataStatus': {
            setProcessedRecords((previousProcessedRecords) => previousProcessedRecords.concat(payload.data.records));
            break;
          }
          case 'loadData': {
            if (payload.error) {
              logger.error('ERROR', payload.error);
              setStatus(STATUSES.ERROR);
              onFinish({ success: 0, failure: inputFileData.length });
              setEndTime(dateString);
              notifyUser(`Your ${loadType.toLowerCase()} data load failed`, {
                body: `❌ ${payload.error?.message || payload.error}`,
                tag: 'load-records',
              });
            } else {
              setStatus(STATUSES.FINISHED);
              onFinish({ success: processingStatusRef.current.success, failure: processingStatusRef.current.failure });
              setEndTime(dateString);
            }
            break;
          }
          default:
            break;
        }
      };
    }
  }, [loadWorker, processingStatusRef.current]);

  function handleDownloadRecords(type: 'results' | 'failures') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const combinedResults: any[] = [];
    // Use field mapping to determine headers in output data and account for relationship fields
    const fields = getFieldHeaderFromMapping(fieldMapping);

    processedRecords.forEach((record) => {
      if (type === 'results' ? true : !record.success) {
        // for failure records, if the Id field is present, then include in _id field
        combinedResults.push({
          _id: record.success ? record.id : record['Id'] || '',
          _success: record.success,
          _errors: record.success === false ? record.errors.map((error) => `${error.statusCode}: ${error.message}`).join('\n') : '',
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
  }

  function handleDownloadProcessingErrors() {
    const fields = getFieldHeaderFromMapping(fieldMapping);
    const header = ['_id', '_success', '_errors'].concat(fields);
    setDownloadModalData({
      ...downloadModalData,
      open: true,
      fileNameParts: [loadType.toLocaleLowerCase(), selectedSObject.toLocaleLowerCase(), 'processing-failures'],
      header,
      data: preparedData.errors.map((error) => ({
        _id: null,
        _success: false,
        _errors: error.errors.join('\n'),
        ...flattenRecord(error.record, fields),
      })),
    });
  }

  function handleModalClose() {
    setDownloadModalData({ open: false, data: [], header: [], fileNameParts: [] });
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
      <h3 className="slds-text-heading_small slds-grid">
        <span>{status}</span>
        {status === STATUSES.PREPARING && <Spinner inline containerClassName="slds-m-left_small" size="x-small" />}
      </h3>
      {fatalError && (
        <div className="slds-text-color_error">
          <strong>Fatal Error</strong>: {fatalError}
        </div>
      )}
      {/* Data is being processed */}
      {startTime && (
        <LoadRecordsBatchApiResultsTable
          processingErrors={preparedData.errors}
          processingStatus={processingStatus}
          failedProcessingStage={!preparedData?.data.length && !!preparedData?.errors.length}
          inProgress={status === STATUSES.PROCESSING}
          failed={status === STATUSES.ERROR}
          startTime={startTime}
          endTime={endTime}
          processingStartTime={processingStartTime}
          processingEndTime={processingEndTime}
          onDownload={handleDownloadRecords}
          onDownloadProcessingErrors={handleDownloadProcessingErrors}
        />
      )}
    </div>
  );
};

export default LoadRecordsBatchApiResults;
