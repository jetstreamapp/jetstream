import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS, SFDC_BULK_API_NULL_VALUE } from '@jetstream/shared/constants';
import { bulkApiAddBatchToJob, bulkApiCreateJob, bulkApiGetJob, queryAll } from '@jetstream/shared/data';
import { checkIfBulkApiJobIsDone, convertDateToLocale, generateCsv, useBrowserNotifications, useRollbar } from '@jetstream/shared/ui-utils';
import { delay, splitArrayToMaxSize } from '@jetstream/shared/utils';
import { BulkJobBatchInfo, Maybe, SalesforceOrgUi } from '@jetstream/types';
import formatDate from 'date-fns/format';
import { useCallback, useEffect, useRef } from 'react';
import { useRecoilCallback, useRecoilState } from 'recoil';
import { applicationCookieState } from '../../../app-state';
import { useAmplitude } from '../../core/analytics';
import * as fromMassUpdateState from '../../update-records/mass-update-records.state';
import { DeployResults, MetadataRow, TransformationOptions } from './mass-update-records.types';
import { composeSoqlQuery, getFieldsToQuery } from './mass-update-records.utils';

export function useDeployRecords(
  org: SalesforceOrgUi,
  onDeployResults: (sobject: string, deployResults: DeployResults, fatalError?: boolean) => void
) {
  const [{ serverUrl }] = useRecoilState(applicationCookieState);
  const isMounted = useRef(true);
  const { notifyUser } = useBrowserNotifications(serverUrl, window.electron?.isFocused);
  const rollbar = useRollbar();
  const { trackEvent } = useAmplitude();

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
   * Update field on each record
   */
  const prepareRecords = useCallback(
    (
      records: any[],
      { selectedField, transformationOptions }: { selectedField: Maybe<string>; transformationOptions: TransformationOptions }
    ) => {
      return records.map((record) => {
        const newRecord = { ...record };
        if (selectedField) {
          if (transformationOptions.option === 'anotherField' && transformationOptions.alternateField) {
            newRecord[selectedField] = newRecord[transformationOptions.alternateField];
          } else if (transformationOptions.option === 'staticValue') {
            newRecord[selectedField] = transformationOptions.staticValue;
          } else {
            newRecord[selectedField] = SFDC_BULK_API_NULL_VALUE;
          }
        }
        return newRecord;
      });
    },
    []
  );

  /**
   * Submit bulk update job
   */
  const performLoad = useCallback(
    async ({
      deployResults,
      sobject,
      fields,
      records,
      batchSize,
      serialMode,
    }: {
      deployResults: DeployResults;
      sobject: string;
      fields: string[];
      records: any[];
      batchSize: number;
      serialMode: boolean;
    }) => {
      const jobInfo = await bulkApiCreateJob(org, { type: 'UPDATE', sObject: sobject, serialMode });
      const jobId = jobInfo.id || '';
      const batches = splitArrayToMaxSize(records, batchSize).map((batch) => ({
        records: batch,
        csv: generateCsv(batch, { header: true, columns: fields }),
      }));

      deployResults.jobInfo = jobInfo;
      deployResults.numberOfBatches = batches.length;
      deployResults.records = records;
      onDeployResults(sobject, deployResults);

      let currItem = 0;
      for (const batch of batches) {
        try {
          const batchResult = await bulkApiAddBatchToJob(org, jobId, batch.csv, currItem === batches.length - 1);
          deployResults.batchIdToIndex = { ...deployResults.batchIdToIndex, [batchResult.id]: currItem };
          deployResults.jobInfo = { ...deployResults.jobInfo };
          deployResults.jobInfo.batches = deployResults.jobInfo.batches || [];
          deployResults.jobInfo.batches = [...deployResults.jobInfo.batches, batchResult];

          onDeployResults(sobject, deployResults);
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
    },
    [org, rollbar, onDeployResults]
  );

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

      onDeployResults(row.sobject, deployResults);

      const { queryResults } = await queryAll(org, composeSoqlQuery(row, fields));
      if (!isMounted.current) {
        return;
      }

      const records = prepareRecords(queryResults.records, {
        selectedField: row.selectedField,
        transformationOptions: row.transformationOptions,
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
        onDeployResults(row.sobject, deployResults);
        return;
      }

      deployResults.status = 'In Progress - Uploading';
      onDeployResults(row.sobject, deployResults);

      await performLoad({
        deployResults,
        sobject: row.sobject,
        fields,
        records,
        batchSize,
        serialMode,
      });

      if (!isMounted.current) {
        return;
      }

      deployResults.status = 'In Progress';
      deployResults.lastChecked = formatDate(new Date(), 'h:mm:ss');
      onDeployResults(row.sobject, deployResults);
    },
    [org, performLoad, prepareRecords, onDeployResults]
  );

  /**
   * Main entry point for loading data for all objects at once
   * Alternatively, loadDataForProvidedRecords can be used if all the records are already obtained with proper fields included
   */
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

          onDeployResults(row.sobject, deployResults);

          rollbar.error('There was an error loading data for mass record update', { message: ex.message, stack: ex.stack });
          logger.error('Error loading data for row', ex);
        }
      }
    },
    [loadDataForRow, rollbar, onDeployResults, trackEvent]
  );

  /**
   * Alternative entry point that skips the query and uses the provided records
   */
  const loadDataForProvidedRecords = useCallback(
    async ({
      initialRecords,
      sobject,
      fields,
      batchSize,
      serialMode,
      selectedField,
      transformationOptions,
    }: {
      initialRecords: any[];
      sobject: string;
      fields: string[];
      batchSize: number;
      serialMode: boolean;
      selectedField: Maybe<string>;
      transformationOptions: TransformationOptions;
    }) => {
      trackEvent(ANALYTICS_KEYS.mass_update_Submitted, {
        batchSize: batchSize,
        serialMode: serialMode,
        numObjects: initialRecords.length,
      });
      const deployResults: DeployResults = {
        done: false,
        processingStartTime: convertDateToLocale(new Date()),
        processingEndTime: null,
        processingErrors: [],
        records: [],
        batchIdToIndex: {},
        status: 'In Progress - Preparing',
      };
      try {
        onDeployResults(sobject, deployResults);
        const records = prepareRecords(initialRecords, { selectedField, transformationOptions });

        deployResults.status = 'In Progress - Uploading';
        onDeployResults(sobject, deployResults);

        performLoad({
          deployResults,
          sobject,
          fields,
          records,
          batchSize,
          serialMode,
        });
      } catch (ex) {
        const newDeployResults: DeployResults = {
          ...deployResults,
          done: true,
          processingStartTime: deployResults.processingStartTime || convertDateToLocale(new Date()),
          processingEndTime: convertDateToLocale(new Date()),
          status: 'Error',
        };

        onDeployResults(sobject, newDeployResults);

        rollbar.error('There was an error loading data for mass record update', { message: ex.message, stack: ex.stack });
        logger.error('Error loading data for row', ex);
      }
    },
    [performLoad, prepareRecords, rollbar, onDeployResults, trackEvent]
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

            onDeployResults(row.sobject, deployResults);
          } catch (ex) {
            logger.error('Error polling bulk api job', ex);
            rollbar.error('There was an error polling bulk api job', { message: ex.message, stack: ex.stack });
            const deployResults: DeployResults = {
              ...row.deployResults,
              done: true,
              status: 'Error',
              processingEndTime: convertDateToLocale(new Date()),
            };
            onDeployResults(row.sobject, deployResults, true);
          }
        }
      }
      return allDone;
    },
    [org, rollbar, onDeployResults]
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

  return {
    loadDataForRows,
    loadDataForProvidedRecords,
    pollResultsUntilDone,
  };
}
