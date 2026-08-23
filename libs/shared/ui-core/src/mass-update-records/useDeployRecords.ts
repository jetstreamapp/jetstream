import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { bulkApiAddBatchToJob, bulkApiCreateJob, bulkApiGetJob } from '@jetstream/shared/data';
import { checkIfBulkApiJobIsDone, convertDateToLocale, generateCsv, tracker, useBrowserNotifications } from '@jetstream/shared/ui-utils';
import { delay, getErrorMessage, splitArrayToMaxSize } from '@jetstream/shared/utils';
import { BulkJobBatchInfo, Maybe, SalesforceOrgUi } from '@jetstream/types';
import { applicationCookieState } from '@jetstream/ui/app-state';
import { DataHistoryEntryHandle } from '@jetstream/ui/data-history';
import { formatDate } from 'date-fns/format';
import { useAtom } from 'jotai';
import { useCallback, useEffect, useRef } from 'react';
import { useAmplitude } from '../analytics';
import { captureMassUpdateResults, MassUpdateHistoryContext, MassUpdateSource, startMassUpdateHistory } from './data-history-capture';
import { DeployResults, MetadataRow, MetadataRowConfiguration } from './mass-update-records.types';
import { getEffectiveRecordLimit, getFieldsToQuery, prepareRecords, queryAndPrepareRecordsForUpdate } from './mass-update-records.utils';

export function useDeployRecords(
  org: SalesforceOrgUi,
  onDeployResults: (sobject: string, deployResults: DeployResults, fatalError?: boolean) => void,
  source: MassUpdateSource = 'STAND-ALONE',
) {
  const [{ serverUrl }] = useAtom(applicationCookieState);
  const isMounted = useRef(true);
  const { notifyUser } = useBrowserNotifications(serverUrl);
  const { trackEvent } = useAmplitude();
  /**
   * Capture contexts for deployments that are still IN FLIGHT, keyed by sobject — the poll loop is
   * driven by rows that carry no handle, so it has to look its deployment's context up. Entries are
   * added when a deployment starts and taken (removed) by whichever path settles it, so a lookup can
   * never return a previous deployment's finished handle.
   */
  const historyCaptureRef = useRef<Record<string, MassUpdateHistoryContext>>({});

  /**
   * Start a deployment's capture and register its context in the same step — a handle that was
   * started but never registered is one the poll loop can never find, so it would sit `in-progress`
   * until unmount with no error. Pairs with `takeHistoryCapture` below.
   */
  const beginHistoryCapture = useCallback(
    ({
      sobject,
      batchSize,
      serialMode,
      configuration,
      limit,
      skipHistory,
    }: {
      sobject: string;
      batchSize: number;
      serialMode: boolean;
      configuration: MetadataRowConfiguration[];
      limit?: Maybe<number>;
      skipHistory?: boolean;
    }): DataHistoryEntryHandle => {
      const handle = startMassUpdateHistory({ org, source, sobject, batchSize, serialMode, configuration, limit, skipHistory });
      historyCaptureRef.current[sobject] = { handle, batchSize, configuration };
      return handle;
    },
    [org, source],
  );

  /** Remove and return a deployment's capture context, so exactly one path can settle it */
  const takeHistoryCapture = useCallback((sobject: string): MassUpdateHistoryContext | undefined => {
    const context = historyCaptureRef.current[sobject];
    delete historyCaptureRef.current[sobject];
    return context;
  }, []);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      // Unmounting mid-deployment abandons the run: polling stops and every settle path is gated on
      // isMounted, so nothing would otherwise settle these entries — see `abandonIfUnsettled` for why
      // a stranded entry matters. Taking each context keeps "exactly one path settles it" true, and
      // `Object.keys` snapshots the keys before `takeHistoryCapture` deletes them.
      Object.keys(historyCaptureRef.current).forEach((sobject) => {
        takeHistoryCapture(sobject)?.handle.abandonIfUnsettled(
          'The update was still running when you left the page, so its final outcome was not recorded.',
        );
      });
    };
  }, [takeHistoryCapture]);

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
      historyHandle,
    }: {
      deployResults: DeployResults;
      sobject: string;
      fields: string[];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      records: any[];
      batchSize: number;
      serialMode: boolean;
      /** This attempt's capture handle, started by the caller (fire-and-forget and self-gating) */
      historyHandle: DataHistoryEntryHandle;
    }) => {
      deployResults = { ...deployResults };

      // Recorded BEFORE the job is created so a failed `bulkApiCreateJob` still leaves an entry that
      // shows "N submitted" with its input file, rather than "—" and nothing to inspect.
      // Exactly the columns the batches below submit, streamed as CSV in bounded chunks. This is the
      // "every record in the object" surface, so a single JSON blob of the full queried rows would
      // be held several times over in memory on the main thread while the upload is still running.
      historyHandle.setSubmittedCount(records.length);
      historyHandle.writeInputRows(records, fields);

      const jobInfo = await bulkApiCreateJob(org, { type: 'UPDATE', sObject: sobject, serialMode });
      const jobId = jobInfo.id || '';

      const batches = splitArrayToMaxSize(records, batchSize).map((batch) => ({
        records: batch,
        csv: generateCsv(batch, { header: true, columns: fields, delimiter: ',' }),
      }));

      deployResults.jobInfo = jobInfo;
      deployResults.numberOfBatches = batches.length;
      deployResults.records = records;
      isMounted.current && onDeployResults(sobject, { ...deployResults });

      let currItem = 0;
      for (const batch of batches) {
        try {
          if (!isMounted.current) {
            return;
          }
          const batchResult = await bulkApiAddBatchToJob(org, jobId, batch.csv, currItem === batches.length - 1);
          deployResults.batchIdToIndex = { ...deployResults.batchIdToIndex, [batchResult.id]: currItem };
          deployResults.jobInfo = { ...deployResults.jobInfo };
          deployResults.jobInfo.batches = deployResults.jobInfo.batches || [];
          deployResults.jobInfo.batches = [...deployResults.jobInfo.batches, batchResult];

          isMounted.current && onDeployResults(sobject, { ...deployResults });
        } catch (ex) {
          // error loading batch
          logger.error('Error loading batch', ex);

          // Log error for investigation of failure - but do not log for known errors
          const errorMessage = getErrorMessage(ex)?.toLowerCase() || '';
          if (!errorMessage.includes('aborted') && !errorMessage.includes('limit exceeded')) {
            tracker.error('There was an error loading batch for mass record update', ex);
          }

          deployResults.processingErrors = [...deployResults.processingErrors];
          batch.records.forEach((record, i) => deployResults.processingErrors.push({ record, errors: [getErrorMessage(ex)], row: i }));
        } finally {
          currItem++;
        }
      }
      deployResults.status = 'In Progress';
      deployResults.lastChecked = formatDate(new Date(), 'h:mm:ss');
      isMounted.current && onDeployResults(sobject, { ...deployResults });
    },
    [org, onDeployResults],
  );

  const loadDataForRow = useCallback(
    async (row: MetadataRow, { batchSize, serialMode, skipHistory }: { batchSize: number; serialMode: boolean; skipHistory?: boolean }) => {
      // `loadDataForRows` keeps iterating after the host unmounts; a row started now would register
      // its capture AFTER the unmount cleanup ran, so nothing would ever settle it
      if (!isMounted.current) {
        return;
      }
      const deployResults: DeployResults = {
        done: false,
        processingStartTime: convertDateToLocale(new Date()),
        processingEndTime: null,
        processingErrors: [],
        records: [],
        batchIdToIndex: {},
        status: 'In Progress - Preparing',
      };

      const fields = getFieldsToQuery(
        row.configuration.map(({ transformationOptions, selectedField }) => ({ transformationOptions, selectedField })),
      );

      onDeployResults(row.sobject, { ...deployResults });

      // Registered BEFORE the query so a query/prepare failure is recorded against THIS attempt —
      // `loadDataForRows`'s catch is what settles it in that case
      const historyHandle = beginHistoryCapture({
        sobject: row.sobject,
        batchSize,
        serialMode,
        configuration: row.configuration,
        limit: row.limit,
        skipHistory,
      });

      const records = await queryAndPrepareRecordsForUpdate(row, fields, org);

      if (!isMounted.current) {
        // The unmount cleanup already took and abandoned this deployment's capture context
        return;
      }

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
        isMounted.current && onDeployResults(row.sobject, { ...deployResults });
        takeHistoryCapture(row.sobject)?.handle.finish({ counts: { total: 0, success: 0, failure: 0 } });
        return;
      }

      deployResults.status = 'In Progress - Uploading';
      isMounted.current && onDeployResults(row.sobject, { ...deployResults });

      await performLoad({
        deployResults,
        sobject: row.sobject,
        // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
        fields: ['Id', ...row.configuration.map(({ selectedField }) => selectedField!)],
        records,
        batchSize,
        serialMode,
        historyHandle,
      });
    },
    [org, performLoad, onDeployResults, beginHistoryCapture, takeHistoryCapture],
  );

  /**
   * Main entry point for loading data for all objects at once
   * Alternatively, loadDataForProvidedRecords can be used if all the records are already obtained with proper fields included
   */
  const loadDataForRows = useCallback(
    async (rows: MetadataRow[], options: { batchSize: number; serialMode: boolean; skipHistory?: boolean }) => {
      trackEvent(ANALYTICS_KEYS.mass_update_Submitted, {
        batchSize: options.batchSize,
        serialMode: options.serialMode,
        numObjects: rows.length,
        hasRecordLimit: rows.some((row) => !!getEffectiveRecordLimit(row.limit)),
        source,
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
            fatalErrorMessage: getErrorMessage(ex),
          };

          isMounted.current && onDeployResults(row.sobject, deployResults);
          takeHistoryCapture(row.sobject)?.handle.fail(getErrorMessage(ex));

          tracker.error('There was an error loading data for mass record update', ex);
          logger.error('Error loading data for row', ex);
        }
      }
    },
    [trackEvent, source, loadDataForRow, onDeployResults, takeHistoryCapture],
  );

  /**
   * Alternative entry point that skips the query and uses the provided records
   */
  const loadDataForProvidedRecords = useCallback(
    async ({
      records: initialRecords,
      sobject,
      fields,
      batchSize,
      serialMode,
      configuration,
      skipHistory,
    }: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      records: any[];
      sobject: string;
      /** Fields to include in load */
      fields: string[];
      batchSize: number;
      serialMode: boolean;
      configuration: MetadataRowConfiguration[];
      skipHistory?: boolean;
    }) => {
      trackEvent(ANALYTICS_KEYS.mass_update_Submitted, {
        batchSize,
        serialMode,
        numObjects: initialRecords.length,
        source,
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
        // No records were provided
        if (initialRecords.length === 0) {
          const deployResults: DeployResults = {
            done: true,
            processingStartTime: convertDateToLocale(new Date()),
            processingEndTime: convertDateToLocale(new Date()),
            processingErrors: [],
            records: [],
            batchIdToIndex: {},
            status: 'Finished',
          };
          onDeployResults(sobject, { ...deployResults });
          return;
        }

        onDeployResults(sobject, { ...deployResults });

        // Registered BEFORE prepareRecords so a transformation failure is recorded against THIS
        // attempt — the catch below is what settles it in that case
        const historyHandle = beginHistoryCapture({ sobject, batchSize, serialMode, configuration, skipHistory });

        const records = prepareRecords(initialRecords, configuration);

        deployResults.status = 'In Progress - Uploading';
        onDeployResults(sobject, { ...deployResults });

        await performLoad({
          deployResults,
          sobject,
          fields,
          records,
          batchSize,
          serialMode,
          historyHandle,
        });
      } catch (ex) {
        const newDeployResults: DeployResults = {
          ...deployResults,
          done: true,
          processingStartTime: deployResults.processingStartTime || convertDateToLocale(new Date()),
          processingEndTime: convertDateToLocale(new Date()),
          status: 'Error',
          fatalErrorMessage: getErrorMessage(ex),
        };

        onDeployResults(sobject, newDeployResults);
        takeHistoryCapture(sobject)?.handle.fail(getErrorMessage(ex));

        tracker.error('There was an error loading data for mass record update', ex);
        logger.error('Error loading data for row', ex);
      }
    },
    [trackEvent, source, onDeployResults, performLoad, beginHistoryCapture, takeHistoryCapture],
  );

  const pollResults = useCallback(
    async (rows: Pick<MetadataRow, 'deployResults' | 'sobject'>[]) => {
      let allDone = true;
      for (const row of rows) {
        if (!row.deployResults.done && row.deployResults.jobInfo?.id) {
          try {
            const jobInfo = await bulkApiGetJob(org, row.deployResults.jobInfo.id);
            const { batchIdToIndex } = row.deployResults;
            // Compared against the batches that were actually RECORDED as added, not the planned count:
            // a batch whose upload failed never appears in the job, so waiting for the planned count
            // would poll forever (and leave the history entry in-progress until unmount). The converse
            // also happens — Salesforce accepted a batch but the response never reached the client
            // (gateway timeout on a large upload) — so batches with no recorded id are dropped first,
            // otherwise the job would hold more batches than we know about and never read as done.
            jobInfo.batches = jobInfo.batches.filter((batch) => batchIdToIndex[batch.id] !== undefined);
            const submittedBatchCount = Object.keys(batchIdToIndex).length;
            const done = submittedBatchCount === 0 || checkIfBulkApiJobIsDone(jobInfo, submittedBatchCount);
            // the batch order is not stable with bulkApiGetJob - ensure order is correct
            const batches: BulkJobBatchInfo[] = [];
            jobInfo.batches.forEach((batch) => {
              batches[batchIdToIndex[batch.id]] = batch;
            });
            jobInfo.batches = batches;

            const deployResults: DeployResults = { ...row.deployResults, jobInfo, lastChecked: formatDate(new Date(), 'h:mm:ss') };
            if (done) {
              deployResults.done = true;
              deployResults.status = 'Finished';
              deployResults.processingEndTime = convertDateToLocale(new Date());

              // Proactively capture per-record results to Data History (bulk results expire server-side).
              // Taking the context settles this deployment — the row won't re-enter this branch once
              // `done` is set, and nothing else can then act on a handle this is about to finish.
              const captureContext = takeHistoryCapture(row.sobject);
              if (captureContext) {
                void captureMassUpdateResults({
                  context: captureContext,
                  org,
                  jobInfo,
                  records: row.deployResults.records,
                  batchIdToIndex: row.deployResults.batchIdToIndex,
                  processingErrorCount: row.deployResults.processingErrors.length,
                });
              }
            } else {
              allDone = false;
            }

            onDeployResults(row.sobject, { ...deployResults });
          } catch (ex) {
            logger.error('Error polling bulk api job', ex);
            tracker.error('There was an error polling bulk api job', ex);
            const deployResults: DeployResults = {
              ...row.deployResults,
              done: true,
              status: 'Error',
              processingEndTime: convertDateToLocale(new Date()),
            };
            onDeployResults(row.sobject, deployResults, true);
            // The job was created and its batches uploaded before polling began, so a failed status
            // poll says nothing about the update itself — Salesforce finishes the job regardless. Settle
            // the entry as `incomplete` (outcome unknown — the same status an abandoned run gets), not
            // `failed`, which would record a most-likely-successful update as a failure.
            takeHistoryCapture(row.sobject)?.handle.finish({
              counts: { total: row.deployResults.records.length, success: 0, failure: 0 },
              status: 'incomplete',
              errorMessage: `Polling for results failed: ${getErrorMessage(ex)}`,
            });
          }
        }
      }
      return allDone;
    },
    [org, onDeployResults, takeHistoryCapture],
  );

  /**
   * Result will be polled until all jobs are done
   * All saving needs to happen in the parent component
   *
   * getRows() should use jotai to store data since the fn will be called multiple times
   * and the data it depends on will have been updated each time the polling happens
   *
   * and onDeployResults() will be called with the modified rows
   */
  const pollResultsUntilDone = useCallback(
    async (getRows: () => Pick<MetadataRow, 'deployResults' | 'sobject'>[]) => {
      try {
        let done = false;
        while (!done && isMounted.current) {
          await delay(5000);
          done = await pollResults(getRows());
        }
        notifyUser(`Updating records has finished`, { body: 'Updating records has finished', tag: 'massUpdateRecords' });
      } catch (ex) {
        tracker.error('There was an error polling for mass record update results', ex);
        logger.warn('Error polling for jobs', ex);
        notifyUser(`Updating records has failed`, { body: 'There was a problem with your data processing', tag: 'massUpdateRecords' });
      }
    },
    [notifyUser, pollResults],
  );

  return {
    loadDataForRows,
    loadDataForProvidedRecords,
    pollResultsUntilDone,
  };
}
