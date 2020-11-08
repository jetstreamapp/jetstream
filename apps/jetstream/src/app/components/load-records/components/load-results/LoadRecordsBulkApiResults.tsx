/** @jsx jsx */
import { jsx } from '@emotion/core';
import { logger } from '@jetstream/shared/client-logger';
import { bulkApiGetJob, bulkApiGetRecords } from '@jetstream/shared/data';
import { convertDateToLocale } from '@jetstream/shared/ui-utils';
import {
  BulkJobBatchInfo,
  BulkJobResultRecord,
  BulkJobWithBatches,
  InsertUpdateUpsertDelete,
  MapOf,
  SalesforceOrgUi,
  WorkerMessage,
} from '@jetstream/types';
import { FileDownloadModal, SalesforceLogin } from '@jetstream/ui';
import { Fragment, FunctionComponent, useEffect, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';
import { applicationCookieState } from '../../../../app-state';
import { ApiMode, FieldMapping, LoadDataBulkApiStatusPayload } from '../../load-records-types';
import LoadWorker from '../../load-records.worker';
import { getFieldHeaderFromMapping } from '../../utils/load-records-utils';
import LoadRecordsBulkApiResultsTable from './LoadRecordsBulkApiResultsTable';

type Status = 'Preparing Data' | 'Uploading Data' | 'Processing Data' | 'Finished' | 'Error';

const STATUSES: {
  PREPARING: Status;
  UPLOADING: Status;
  PROCESSING: Status;
  FINISHED: Status;
  ERROR: Status;
} = {
  PREPARING: 'Preparing Data',
  UPLOADING: 'Uploading Data',
  PROCESSING: 'Processing Data',
  FINISHED: 'Finished',
  ERROR: 'Error',
};

const CHECK_INTERVAL = 3000;
const MAX_INTERVAL_CHECK_COUNT = 200; // 3000*200/60=10 minutes

function checkIfJobIsDone(jobInfo: BulkJobWithBatches, batchSummary: LoadDataBulkApiStatusPayload) {
  if (jobInfo.state === 'Failed') {
    return true;
  }
  return (
    jobInfo.batches.length > 0 &&
    jobInfo.batches.length === batchSummary.totalBatches &&
    jobInfo.batches.every((batch) => batch.state === 'Completed' || batch.state === 'Failed' || batch.state === 'NotProcessed')
  );
}

export interface LoadRecordsBulkApiResultsProps {
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
  onFinish: () => void;
}

export const LoadRecordsBulkApiResults: FunctionComponent<LoadRecordsBulkApiResultsProps> = ({
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
  const [{ serverUrl }] = useRecoilState(applicationCookieState);
  const [preparedData, setPreparedData] = useState<any[]>();
  const [loadWorker] = useState(() => new LoadWorker());
  const [status, setStatus] = useState<Status>(STATUSES.PREPARING);
  const [fatalError, setFatalError] = useState<string>(null);
  const [downloadError, setDownloadError] = useState<string>(null);
  const [jobInfo, setJobInfo] = useState<BulkJobWithBatches>();
  const [batchSummary, setBatchSummary] = useState<LoadDataBulkApiStatusPayload>();
  // Salesforce changes order of batches, so we want to ensure order is retained based on the input file
  const [batchIdByIndex, setBatchIdByIndex] = useState<MapOf<number>>();
  const [intervalCount, setIntervalCount] = useState<number>(0);
  const [downloadModalData, setDownloadModalData] = useState({
    open: false,
    data: [],
    header: [],
    fileNameParts: [],
    url: '',
    filename: '',
  });

  useEffect(() => {
    isMounted.current = true;
    return () => (isMounted.current = false);
  }, []);

  useEffect(() => {
    if (batchSummary && batchSummary.batchSummary) {
      const batchSummariesWithId = batchSummary.batchSummary.filter((batch) => batch.id);
      if (Array.isArray(batchSummariesWithId)) {
        setBatchIdByIndex(
          batchSummariesWithId.reduce((output: MapOf<number>, batch) => {
            output[batch.id] = batch.batchNumber;
            return output;
          }, {})
        );
      }
    }
  }, [batchSummary]);

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
    if (jobInfo) {
      const isDone = checkIfJobIsDone(jobInfo, batchSummary);
      if (isDone) {
        setStatus(STATUSES.FINISHED);
        onFinish();
      } else if (status === STATUSES.PROCESSING && intervalCount < MAX_INTERVAL_CHECK_COUNT) {
        // we need to wait until all data is uploaded?
        setTimeout(async () => {
          if (!isMounted.current) {
            return;
          }
          const jobInfoWithBatches = await bulkApiGetJob(selectedOrg, jobInfo.id);
          if (!isMounted.current) {
            return;
          }
          // jobInfoWithBatches.batches = orderBy(jobInfoWithBatches.batches, ['createdDate']);
          const batches: BulkJobBatchInfo[] = [];
          // re-order (if needed) and enrich data
          jobInfoWithBatches.batches.forEach((batch) => {
            batch.createdDate = convertDateToLocale(batch.createdDate);
            batch.systemModstamp = convertDateToLocale(batch.systemModstamp);
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

  useEffect(() => {
    if (loadWorker) {
      loadWorker.onmessage = (event: MessageEvent) => {
        if (!isMounted.current) {
          return;
        }
        const payload: WorkerMessage<
          'prepareData' | 'loadDataStatus' | 'loadData',
          { preparedData?: any[]; jobInfo?: BulkJobWithBatches; resultsSummary?: LoadDataBulkApiStatusPayload }
        > = event.data;
        logger.log('[LOAD DATA]', payload.name, { payload });
        switch (payload.name) {
          case 'prepareData': {
            if (payload.error) {
              logger.error('ERROR', payload.error);
              setStatus(STATUSES.ERROR);
              setFatalError(payload.error.message);
              onFinish();
            } else {
              setStatus(STATUSES.UPLOADING);
              setPreparedData(payload.data.preparedData);
            }
            break;
          }
          case 'loadDataStatus': {
            setBatchSummary(payload.data.resultsSummary);
            if (Array.isArray(payload.data.resultsSummary.jobInfo.batches) && payload.data.resultsSummary.jobInfo.batches.length) {
              setJobInfo(payload.data.resultsSummary.jobInfo);
            }
            break;
          }
          case 'loadData': {
            if (payload.error) {
              logger.error('ERROR', payload.error);
              setStatus(STATUSES.ERROR);
              onFinish();
            } else {
              setJobInfo(payload.data.jobInfo);
              setStatus(STATUSES.PROCESSING);
            }
            break;
          }
          default:
            break;
        }
      };
    }
  }, [loadWorker]);

  function getUploadingText() {
    if (
      !batchSummary ||
      !(status === STATUSES.UPLOADING || status === STATUSES.PROCESSING) ||
      batchSummary.totalBatches === jobInfo?.batches?.length
    ) {
      return '';
    }
    return `Uploading batch ${batchSummary.batchSummary.filter((item) => item.completed).length} of ${batchSummary.totalBatches}`;
  }

  async function handleDownloadRecords(type: 'results' | 'failure', batch: BulkJobBatchInfo, batchIndex: number): Promise<void> {
    try {
      if (downloadError) {
        setDownloadError(null);
      }
      // download records, combine results from salesforce with actual records, open download modal
      const results = await bulkApiGetRecords<BulkJobResultRecord>(selectedOrg, jobInfo.id, batch.id, 'result');
      // this should match, but will fallback to batchIndex if for some reason we cannot find the batch
      const batchSummaryItem = batchSummary.batchSummary.find((item) => item.id === batch.id);
      const startIdx = (batchSummaryItem?.batchNumber ?? batchIndex) * batchSize;
      const records: any[] = preparedData.slice(startIdx, startIdx + batchSize);
      const combinedResults = [];
      results.forEach((resultRecord, i) => {
        // show all if results, otherwise just include errors
        if (type === 'results' || !resultRecord.Success) {
          combinedResults.push({
            _id: resultRecord.Id || records[i].Id || null,
            _success: resultRecord.Success,
            _errors: resultRecord.Error,
            ...records[i],
          });
        }
      });
      logger.log({ combinedResults });
      const header = ['_id', '_success', '_errors'].concat(getFieldHeaderFromMapping(fieldMapping));
      setDownloadModalData({ ...downloadModalData, open: true, fileNameParts: ['load', type], header, data: combinedResults });
    } catch (ex) {
      logger.warn(ex);
      setDownloadError('ex.message');
    }
  }

  function handleModalClose() {
    setDownloadModalData({ ...downloadModalData, open: false, fileNameParts: [], url: '', filename: '' });
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
      <h3 className="slds-text-heading_small">
        {status} <span className="slds-text-title">{getUploadingText()}</span>
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
        <Fragment>
          <SalesforceLogin
            serverUrl={serverUrl}
            org={selectedOrg}
            returnUrl={`/lightning/setup/AsyncApiJobStatus/page?address=%2F${batchSummary.jobInfo.id}`}
            iconPosition="right"
          >
            View job in Salesforce
          </SalesforceLogin>
        </Fragment>
      )}
      {/* Data is being processed */}
      {jobInfo && (
        <LoadRecordsBulkApiResultsTable
          selectedOrg={selectedOrg}
          serverUrl={serverUrl}
          jobInfo={jobInfo}
          onDownload={handleDownloadRecords}
        />
      )}
    </div>
  );
};

export default LoadRecordsBulkApiResults;
