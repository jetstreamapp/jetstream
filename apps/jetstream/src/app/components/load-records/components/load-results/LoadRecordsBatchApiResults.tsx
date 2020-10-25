/** @jsx jsx */
import { jsx } from '@emotion/core';
import { logger } from '@jetstream/shared/client-logger';
import { InsertUpdateUpsertDelete, RecordResultWithRecord, SalesforceOrgUi, WorkerMessage } from '@jetstream/types';
import { flattenRecord } from '@jetstream/shared/utils';
import { FunctionComponent, useEffect, useRef, useState } from 'react';
import LoadWorker from '../../../../workers/load.worker';
import FileDownloadModal from '../../../core/FileDownloadModal';
import { ApiMode, FieldMapping, LoadDataBatchApiProgress } from '../../load-records-types';
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
  serialMode,
  dateFormat,
  onFinish,
}) => {
  const isMounted = useRef(null);
  const [preparedData, setPreparedData] = useState<any[]>();
  const [loadWorker] = useState(() => new LoadWorker());
  const [status, setStatus] = useState<Status>(STATUSES.PREPARING);
  const [startTime, setStartTime] = useState<string>(null);
  const [endTime, setEndTime] = useState<string>(null);
  const [processedRecords, setProcessedRecords] = useState<RecordResultWithRecord[]>([]);
  const [processingStatus, setProcessingStatus] = useState<LoadDataBatchApiProgress>({
    total: 0,
    success: 0,
    failure: 0,
  });
  const [downloadModalData, setDownloadModalData] = useState({ open: false, data: [], header: [], fileNameParts: [] });

  useEffect(() => {
    isMounted.current = true;
    return () => (isMounted.current = false);
  }, []);

  useEffect(() => {
    if (loadWorker) {
      setStatus(STATUSES.PREPARING);
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
          serialMode,
          externalId,
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preparedData]);

  /**
   * When jobInfo is modified, check to see if everything is done
   * If not done and status is processing, then continue polling
   */
  useEffect(() => {
    if (Array.isArray(processedRecords) && processedRecords.length > 0) {
      setProcessingStatus({
        total: preparedData.length,
        success: processedRecords.filter((record) => record.success).length,
        failure: processedRecords.filter((record) => !record.success).length,
      });
    }
  }, [preparedData, processedRecords, status]);

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
            } else {
              setStatus(STATUSES.PROCESSING);
              setPreparedData(payload.data.preparedData);
            }
            setStartTime(new Date().toLocaleString());
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
            } else {
              setStatus(STATUSES.FINISHED);
              setEndTime(new Date().toLocaleString());
            }
            onFinish();
            setEndTime(new Date().toLocaleString());
            break;
          }
          default:
            break;
        }
      };
    }
  }, [loadWorker]);

  function handleDownloadRecords(type: 'results' | 'failure') {
    let data: any[] = [];
    // Use field mapping to determine headers in output data and account for relationship fields
    const fields = Object.values(fieldMapping)
      .filter((item) => !!item.targetField)
      .map((item) => {
        let output = item.targetField;
        if (item.mappedToLookup && item.targetLookupField) {
          output = `${item.relationshipName}.${item.targetLookupField}`;
        }
        return output;
      });

    data = processedRecords
      .filter((record: RecordResultWithRecord) => (type === 'results' ? true : !record.success))
      .map((record) => {
        return {
          _id: record.success ? record.id : '',
          _success: record.success,
          _errors: record.success === false ? record.errors.map((error) => error.message).join('\n') : '',
          ...flattenRecord(record.record, fields),
        };
      });

    const header = ['_id', '_success', '_errors'].concat(fields);
    setDownloadModalData({ open: true, data, header, fileNameParts: ['load', type] });
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
