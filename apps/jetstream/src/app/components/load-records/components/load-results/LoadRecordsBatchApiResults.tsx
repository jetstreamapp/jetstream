/** @jsx jsx */
import { jsx } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { useBrowserNotifications } from '@jetstream/shared/ui-utils';
import { flattenRecord, pluralizeFromNumber } from '@jetstream/shared/utils';
import { InsertUpdateUpsertDelete, RecordResultWithRecord, SalesforceOrgUi, WorkerMessage } from '@jetstream/types';
import { FileDownloadModal } from '@jetstream/ui';
import { FunctionComponent, useEffect, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';
import { applicationCookieState } from '../../../../app-state';
import { ApiMode, FieldMapping, LoadDataBatchApiProgress } from '../../load-records-types';
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
  onFinish: () => void; // TODO: add types
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
  const [preparedData, setPreparedData] = useState<any[]>();
  const [loadWorker] = useState(() => new LoadWorker());
  const [status, setStatus] = useState<Status>(STATUSES.PREPARING);
  const [fatalError, setFatalError] = useState<string>(null);
  const [startTime, setStartTime] = useState<string>(null);
  const [endTime, setEndTime] = useState<string>(null);
  const [processedRecords, setProcessedRecords] = useState<RecordResultWithRecord[]>([]);
  const [processingStatus, setProcessingStatus] = useState<LoadDataBatchApiProgress>({
    total: 0,
    success: 0,
    failure: 0,
  });
  const [downloadModalData, setDownloadModalData] = useState({ open: false, data: [], header: [], fileNameParts: [] });
  const [{ serverUrl }] = useRecoilState(applicationCookieState);
  const { notifyUser } = useBrowserNotifications(serverUrl);

  useEffect(() => {
    isMounted.current = true;
    return () => (isMounted.current = false);
  }, []);

  useEffect(() => {
    if (loadWorker) {
      setStatus(STATUSES.PREPARING);
      setFatalError(null);
      loadWorker.postMessage({
        name: 'prepareData',
        data: {
          data: inputFileData,
          fieldMapping,
          sObject: selectedSObject,
          insertNulls,
          dateFormat,
          apiMode,
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadWorker]);

  useEffect(() => {
    if (preparedData) {
      // transform data on init
      loadWorker.postMessage({
        name: 'loadData',
        data: {
          org: selectedOrg,
          data: preparedData,
          sObject: selectedSObject,
          apiMode,
          type: loadType,
          batchSize,
          assignmentRuleId,
          serialMode,
          externalId,
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preparedData]);

  useEffect(() => {
    if (Array.isArray(processedRecords) && processedRecords.length > 0) {
      setProcessingStatus({
        total: preparedData.length,
        success: processedRecords.filter((record) => record.success).length,
        failure: processedRecords.filter((record) => !record.success).length,
      });
    }
  }, [preparedData, processedRecords]);

  useEffect(() => {
    if (status === STATUSES.FINISHED) {
      notifyUser(`Your ${loadType.toLowerCase()} data load is finished`, {
        body: `✅ ${processingStatus.success.toLocaleString()} ${pluralizeFromNumber(
          'record',
          processingStatus.success
        )} loaded successfully ❌ ${processingStatus.failure.toLocaleString()} ${pluralizeFromNumber(
          'record',
          processingStatus.failure
        )} failed`,
        tag: 'load-records',
      });
    }
  }, [status, processingStatus]);

  useEffect(() => {
    if (loadWorker) {
      loadWorker.onmessage = (event: MessageEvent) => {
        if (!isMounted.current) {
          return;
        }
        const payload: WorkerMessage<
          'prepareData' | 'loadDataStatus' | 'loadData',
          { preparedData?: any[]; records?: RecordResultWithRecord[] }
        > = event.data;
        logger.log('[LOAD DATA]', payload.name, { payload });
        switch (payload.name) {
          case 'prepareData': {
            if (payload.error) {
              logger.error('ERROR', payload.error);
              setStatus(STATUSES.ERROR);
              setFatalError(payload.error.message);
              onFinish();
              notifyUser(`⚠️ Your ${loadType.toLowerCase()} data load failed`, {
                body: `Error: ${payload.error?.message || payload.error}`,
                tag: 'load-records',
              });
            } else {
              setStatus(STATUSES.PROCESSING);
              setPreparedData(payload.data.preparedData);
              setStartTime(new Date().toLocaleString());
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
              onFinish();
              setEndTime(new Date().toLocaleString());
              notifyUser(`⚠️ Your ${loadType.toLowerCase()} data load failed`, {
                body: `Error: ${payload.error?.message || payload.error}`,
                tag: 'load-records',
              });
            } else {
              setStatus(STATUSES.FINISHED);
              onFinish();
              setEndTime(new Date().toLocaleString());
            }
            break;
          }
          default:
            break;
        }
      };
    }
  }, [loadWorker]);

  function handleDownloadRecords(type: 'results' | 'failures') {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const data: any[] = [];
    // Use field mapping to determine headers in output data and account for relationship fields
    const fields = getFieldHeaderFromMapping(fieldMapping);

    processedRecords.forEach((record) => {
      if (type === 'results' ? true : !record.success) {
        // for failure records, if the Id field is present, then include in _id field
        data.push({
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
      data,
      header,
      fileNameParts: [loadType.toLocaleLowerCase(), selectedSObject.toLocaleLowerCase(), type],
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
          data={downloadModalData.data}
          header={downloadModalData.header}
          fileNameParts={downloadModalData.fileNameParts}
          onModalClose={handleModalClose}
        />
      )}
      <h3 className="slds-text-heading_small">{status}</h3>
      {fatalError && (
        <div className="slds-text-color_error">
          <strong>Fatal Error</strong>: {fatalError}
        </div>
      )}
      {/* Data is being processed */}
      {startTime && (
        <LoadRecordsBatchApiResultsTable
          processingStatus={processingStatus}
          inProgress={status === STATUSES.PROCESSING}
          failed={status === STATUSES.ERROR}
          startTime={startTime}
          endTime={endTime}
          onDownload={handleDownloadRecords}
        />
      )}
    </div>
  );
};

export default LoadRecordsBatchApiResults;
