/** @jsx jsx */
import { jsx } from '@emotion/core';
import { logger } from '@jetstream/shared/client-logger';
import { bulkApiGetJob } from '@jetstream/shared/data';
import { BulkJobWithBatches, FileExtCsvXLSX, InsertUpdateUpsertDelete, SalesforceOrgUi, WorkerMessage } from '@jetstream/types';
import { SalesforceLogin } from '@jetstream/ui';
import { Fragment, FunctionComponent, useEffect, useRef, useState } from 'react';
import { useRecoilState } from 'recoil';
import { convertDateToLocale } from '@jetstream/shared/ui-utils';
import { applicationCookieState } from '../../../../app-state';
import LoadWorker from '../../../../workers/load.worker';
import { ApiMode, FieldMapping, LoadDataBulkApiStatusPayload } from '../../load-records-types';
import LoadRecordsBulkApiResultsTable from './LoadRecordsBulkApiResultsTable';
import orderBy from 'lodash/orderBy';
import FileDownloadModal from '../../../core/FileDownloadModal';

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

let currTimeout: any;

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
  const [jobInfo, setJobInfo] = useState<BulkJobWithBatches>();
  const [batchSummary, setBatchSummary] = useState<LoadDataBulkApiStatusPayload>();
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
          jobInfoWithBatches.batches = orderBy(jobInfoWithBatches.batches, ['createdDate']);
          jobInfoWithBatches.batches.forEach((batch) => {
            batch.createdDate = convertDateToLocale(batch.createdDate);
            batch.systemModstamp = convertDateToLocale(batch.systemModstamp);
          });
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

  function handleDownloadRecords(type: 'results' | 'failure', url: string) {
    setDownloadModalData({ ...downloadModalData, open: true, fileNameParts: ['load', type], url });
  }

  function handleModalClose() {
    setDownloadModalData({ ...downloadModalData, open: false, fileNameParts: [], url: '', filename: '' });
  }

  function handleModalChange({ fileName, fileFormat }: { fileName: string; fileFormat: FileExtCsvXLSX }) {
    const fullFilename = encodeURIComponent(`${fileName}.${fileFormat}`);
    if (downloadModalData.filename !== fullFilename) {
      setDownloadModalData({ ...downloadModalData, filename: encodeURIComponent(`${fileName}.${fileFormat}`) });
    }
  }

  return (
    <div>
      {downloadModalData.open && (
        <FileDownloadModal
          org={selectedOrg}
          data={downloadModalData.data}
          header={downloadModalData.header}
          fileNameParts={downloadModalData.fileNameParts}
          allowedTypes={['csv']}
          onModalClose={handleModalClose}
          onChange={handleModalChange}
          alternateDownloadButton={
            <a
              className="slds-button slds-button_brand"
              href={`${downloadModalData.url}&filename=${downloadModalData.filename}`}
              target="_blank"
              rel="noreferrer"
              onClick={handleModalClose}
            >
              Download
            </a>
          }
        />
      )}
      <h3 className="slds-text-heading_small">
        {status} <span className="slds-text-title">{getUploadingText()}</span>
      </h3>
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
