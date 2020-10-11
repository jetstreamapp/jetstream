/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { BulkJob, BulkJobWithBatches, InsertUpdateUpsertDelete, MapOf, SalesforceOrgUi, WorkerMessage } from '@jetstream/types';
import { ApiMode, FieldMapping, LoadDataStatusPayload } from '../load-records-types';
import LoadWorker from '../../../workers/load.worker';
import { logger } from '@jetstream/shared/client-logger';
import { SalesforceLogin } from '@jetstream/ui';
import { applicationCookieState } from '../../../app-state';
import { useRecoilState } from 'recoil';
import LoadRecordsBatchResultsTable from './LoadRecordsBatchResultsTable';
import { bulkApiGetJob } from '@jetstream/shared/data';

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

function checkIfJobIsDone(jobInfo: BulkJobWithBatches) {
  if (jobInfo.state === 'Failed') {
    return true;
  }
  return (
    jobInfo.batches.length > 0 &&
    jobInfo.batches.every((batch) => batch.state === 'Completed' || batch.state === 'Failed' || batch.state === 'NotProcessed')
  );
}

export interface LoadRecordsLoadRecordsResultsProps {
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
  onFinish: (success: boolean) => void; // TODO: add types
}

export const LoadRecordsLoadRecordsResults: FunctionComponent<LoadRecordsLoadRecordsResultsProps> = ({
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
  const [{ serverUrl }] = useRecoilState(applicationCookieState);
  const [preparedData, setPreparedData] = useState<any[]>();
  const [loadWorker] = useState(() => new LoadWorker());
  const [status, setStatus] = useState<Status>(STATUSES.PREPARING);
  const [jobInfo, setJobInfo] = useState<BulkJobWithBatches>();
  const [batchSummary, setBatchSummary] = useState<LoadDataStatusPayload>();
  const [intervalCount, setIntervalCount] = useState<number>(0);

  /**
   * TODO:
   * transform data
   * - remove unmapped fields
   * - ensure fields are in correct data type (might only apply to dat)
   * submit data to salesforce
   * show results
   */

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
      const isDone = checkIfJobIsDone(jobInfo);
      if (isDone) {
        setStatus(STATUSES.FINISHED);
      } else if (status === STATUSES.PROCESSING && intervalCount < MAX_INTERVAL_CHECK_COUNT) {
        // we need to wait until all data is uploaded?
        setTimeout(async () => {
          const jobInfoWithBatches = await bulkApiGetJob(selectedOrg, jobInfo.id);
          setJobInfo(jobInfoWithBatches);
          setIntervalCount(intervalCount + 1);
        }, CHECK_INTERVAL);
      }
    }
  }, [jobInfo, status]);

  useEffect(() => {
    if (loadWorker) {
      loadWorker.onmessage = (event: MessageEvent) => {
        const payload: WorkerMessage<
          'prepareData' | 'loadDataStatus' | 'loadData',
          { preparedData?: any[]; jobInfo?: BulkJobWithBatches; resultsSummary?: LoadDataStatusPayload }
        > = event.data;
        logger.log('prepareData', { payload });
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
            break;
          }
          case 'loadData': {
            if (payload.error) {
              logger.error('ERROR', payload.error);
              onFinish(false);
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

  /**
   * BULK:
   * State 1: initial
   * State 2: Creating Job (VERY QUICK)
   * State 3: Uploading batches (could be quick or slow depending on batches)
   * State 4: Monitoring to completion
   * State 5: Finished - success
   * State 6: Finished - with errors
   *
   * BATCH:
   * State 1: initial
   * State 2: Uploading batches (allow cancellation if more batches)
   * State 3: Finished - success
   * State 4: Finished - with errors
   */

  return (
    <div>
      <h3 className="slds-text-heading_small">{status}</h3>
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
      {/* Data is being uploaded */}
      {batchSummary && !jobInfo && (
        <div>
          Uploading batch {batchSummary.batchSummary.filter((item) => item.completed).length} of {batchSummary.totalBatches}
        </div>
      )}
      {/* Data is being processed */}
      {jobInfo && <LoadRecordsBatchResultsTable selectedOrg={selectedOrg} serverUrl={serverUrl} jobInfo={jobInfo} />}
    </div>
  );
};

export default LoadRecordsLoadRecordsResults;
