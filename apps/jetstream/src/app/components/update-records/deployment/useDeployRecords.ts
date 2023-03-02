import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS, SFDC_BULK_API_NULL_VALUE } from '@jetstream/shared/constants';
import { bulkApiAddBatchToJob, bulkApiCreateJob, bulkApiGetJob, queryAll } from '@jetstream/shared/data';
import { checkIfBulkApiJobIsDone, convertDateToLocale, generateCsv, useBrowserNotifications, useRollbar } from '@jetstream/shared/ui-utils';
import { delay, splitArrayToMaxSize } from '@jetstream/shared/utils';
import { BulkJobBatchInfo, SalesforceOrgUi } from '@jetstream/types';
import formatDate from 'date-fns/format';
import { useCallback, useEffect, useRef } from 'react';
import { useRecoilCallback, useRecoilState, useSetRecoilState } from 'recoil';
import { applicationCookieState } from '../../../app-state';
import { useAmplitude } from '../../core/analytics';
import * as fromMassUpdateState from '../mass-update-records.state';
import { DeployResults, MetadataRow } from '../mass-update-records.types';
import { composeSoqlQuery, getFieldsToQuery } from '../mass-update-records.utils';

const updateDeploymentResultsState =
  (sobject: string, deployResults: DeployResults, fatalError?: boolean) => (priorRowsMap: Map<string, MetadataRow>) => {
    const rowsMap = new Map(priorRowsMap);
    const row: MetadataRow = { ...rowsMap.get(sobject), deployResults: { ...deployResults } } as MetadataRow;
    // Something went horribly wrong (e.x. lost internet connection) mark all as not processed
    if (fatalError && row.deployResults.jobInfo?.batches?.length) {
      row.deployResults.jobInfo = { ...row.deployResults.jobInfo, state: 'Failed' };
      row.deployResults.jobInfo.batches = row.deployResults.jobInfo.batches.map((batch): BulkJobBatchInfo => {
        if (batch.state !== 'Completed') {
          return { ...batch, state: 'NotProcessed' };
        }
        return batch;
      });
    }
    rowsMap.set(row.sobject, row);
    return rowsMap;
  };

export function useDeployRecords(org: SalesforceOrgUi) {
  const [{ serverUrl }] = useRecoilState(applicationCookieState);
  const isMounted = useRef(true);
  const { notifyUser } = useBrowserNotifications(serverUrl, window.electron?.isFocused);
  const rollbar = useRollbar();
  const { trackEvent } = useAmplitude();

  const setRowDeployResults = useSetRecoilState(fromMassUpdateState.rowsMapState);
  const getRows = useRecoilCallback(
    ({ snapshot }) =>
      () => {
        return snapshot.getLoadable(fromMassUpdateState.rowsState).getValue();
      },
    []
  );

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  /**
   * TODO: break this up into smaller functions outside of hook
   */
  const loadDataForRow = useCallback(
    async (row: MetadataRow, { batchSize, serialMode }: { batchSize: number; serialMode: boolean }) => {
      const deployResults: DeployResults = {
        done: false,
        processingStartTime: convertDateToLocale(new Date()),
        processingEndTime: null,
        processingErrors: [],
        records: [],
        batchIdToIndex: {},
        status: 'In Progress - Preparing',
      };

      const fields = getFieldsToQuery(row);

      setRowDeployResults(updateDeploymentResultsState(row.sobject, deployResults));

      const { queryResults } = await queryAll(org, composeSoqlQuery(row, fields));
      if (!isMounted.current) {
        return;
      }

      const records = queryResults.records.map((record) => {
        const newRecord = { ...record };
        if (row.selectedField) {
          if (row.transformationOptions.option === 'anotherField' && row.transformationOptions.alternateField) {
            newRecord[row.selectedField] = newRecord[row.transformationOptions.alternateField];
          } else if (row.transformationOptions.option === 'staticValue') {
            newRecord[row.selectedField] = row.transformationOptions.staticValue;
          } else {
            newRecord[row.selectedField] = SFDC_BULK_API_NULL_VALUE;
          }
        }
        return newRecord;
      });

      // There are no records to update for this object
      if (records.length === 0) {
        const deployResults: DeployResults = {
          done: true,
          processingStartTime: convertDateToLocale(new Date()),
          processingEndTime: convertDateToLocale(new Date()),
          processingErrors: [],
          records: [],
          batchIdToIndex: {},
          status: 'Finished',
        };
        setRowDeployResults(updateDeploymentResultsState(row.sobject, deployResults));
        return;
      }

      deployResults.status = 'In Progress - Uploading';
      setRowDeployResults(updateDeploymentResultsState(row.sobject, deployResults));

      const jobInfo = await bulkApiCreateJob(org, { type: 'UPDATE', sObject: row.sobject, serialMode });
      const jobId = jobInfo.id || '';
      const batches = splitArrayToMaxSize(records, batchSize).map((batch) => ({
        records: batch,
        csv: generateCsv(batch, { header: true, columns: fields }),
      }));

      deployResults.jobInfo = jobInfo;
      deployResults.numberOfBatches = batches.length;
      deployResults.records = records;
      setRowDeployResults(updateDeploymentResultsState(row.sobject, deployResults));

      let currItem = 0;
      for (const batch of batches) {
        try {
          const batchResult = await bulkApiAddBatchToJob(org, jobId, batch.csv, currItem === batches.length - 1);
          deployResults.batchIdToIndex = { ...deployResults.batchIdToIndex, [batchResult.id]: currItem };
          deployResults.jobInfo = { ...deployResults.jobInfo };
          deployResults.jobInfo.batches = deployResults.jobInfo.batches || [];
          deployResults.jobInfo.batches = [...deployResults.jobInfo.batches, batchResult];

          setRowDeployResults(updateDeploymentResultsState(row.sobject, deployResults));
        } catch (ex) {
          // error loading batch
          logger.error('Error loading batch', ex);
          rollbar.error('There was an error loading batch for mass record update', { message: ex.message, stack: ex.stack });
          deployResults.processingErrors = [...deployResults.processingErrors];
          batch.records.forEach((i, record) => deployResults.processingErrors.push({ record, errors: [ex.message], row: i }));
        } finally {
          currItem++;
        }
      }

      if (!isMounted.current) {
        return;
      }

      deployResults.status = 'In Progress';
      deployResults.lastChecked = formatDate(new Date(), 'h:mm:ss');
      setRowDeployResults(updateDeploymentResultsState(row.sobject, deployResults));
    },
    [org, rollbar, setRowDeployResults]
  );

  const loadDataForRows = useCallback(
    async (rows: MetadataRow[], options: { batchSize: number; serialMode: boolean }) => {
      trackEvent(ANALYTICS_KEYS.mass_update_Submitted, {
        batchSize: options.batchSize,
        serialMode: options.serialMode,
        numObjects: rows.length,
      });
      for (const row of rows) {
        try {
          await loadDataForRow(row, options);
        } catch (ex) {
          const deployResults: DeployResults = {
            ...row.deployResults,
            done: true,
            processingStartTime: row.deployResults.processingStartTime || convertDateToLocale(new Date()),
            processingEndTime: convertDateToLocale(new Date()),
            status: 'Error',
          };

          setRowDeployResults(updateDeploymentResultsState(row.sobject, deployResults));

          rollbar.error('There was an error loading data for mass record update', { message: ex.message, stack: ex.stack });
          logger.error('Error loading data for row', ex);
        }
      }
    },
    [loadDataForRow, rollbar, setRowDeployResults, trackEvent]
  );

  const pollResults = useCallback(
    async (rows: MetadataRow[]) => {
      let allDone = true;
      for (const row of rows) {
        if (!row.deployResults.done && row.deployResults.jobInfo?.id) {
          try {
            const jobInfo = await bulkApiGetJob(org, row.deployResults.jobInfo.id);
            const done = checkIfBulkApiJobIsDone(jobInfo, row.deployResults.numberOfBatches ?? 0);

            // the batch order is not stable with bulkApiGetJob - ensure order is correct
            const batches: BulkJobBatchInfo[] = [];
            jobInfo.batches.forEach((batch) => {
              batches[row.deployResults.batchIdToIndex[batch.id]] = batch;
            });
            jobInfo.batches = batches;

            const deployResults: DeployResults = { ...row.deployResults, jobInfo, lastChecked: formatDate(new Date(), 'h:mm:ss') };
            if (done) {
              deployResults.done = true;
              deployResults.status = 'Finished';
              deployResults.processingEndTime = convertDateToLocale(new Date());
            } else {
              allDone = false;
            }

            setRowDeployResults(updateDeploymentResultsState(row.sobject, deployResults));
          } catch (ex) {
            logger.error('Error polling bulk api job', ex);
            rollbar.error('There was an error polling bulk api job', { message: ex.message, stack: ex.stack });
            const deployResults: DeployResults = {
              ...row.deployResults,
              done: true,
              status: 'Error',
              processingEndTime: convertDateToLocale(new Date()),
            };
            setRowDeployResults(updateDeploymentResultsState(row.sobject, deployResults, true));
          }
        }
      }
      return allDone;
    },
    [org, rollbar, setRowDeployResults]
  );

  const pollResultsUntilDone = useCallback(async () => {
    try {
      let done = false;
      while (!done && isMounted.current) {
        await delay(5000);
        done = await pollResults(getRows());
      }
      notifyUser(`Updating records has finished`, { body: 'Updating records has finished', tag: 'massUpdateRecords' });
    } catch (ex) {
      rollbar.error('There was an error polling for mass record update results', { message: ex.message, stack: ex.stack });
      logger.warn('Error polling for jobs', ex);
      notifyUser(`Updating records has failed`, { body: 'There was a problem with your data processing', tag: 'massUpdateRecords' });
    }
  }, [getRows, notifyUser, pollResults, rollbar]);

  return { loadDataForRows, pollResultsUntilDone };
}
