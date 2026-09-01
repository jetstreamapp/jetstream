import { logger } from '@jetstream/shared/client-logger';
import { useInterval, useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { getErrorMessage, groupByFlat } from '@jetstream/shared/utils';
import type { ApexTestRunResultRecord, SalesforceOrgUi } from '@jetstream/types';
import orderBy from 'lodash/orderBy';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchTestRuns, IN_PROGRESS_TEST_RUN_STATUSES } from './apex-test-runner-data.utils';

const ACTIVE_POLL_INTERVAL = 5000;
const IDLE_POLL_INTERVAL = 30000;
const MAX_POLL_ERRORS = 25;

export function isTestRunInProgress(run: Pick<ApexTestRunResultRecord, 'Status'>): boolean {
  return IN_PROGRESS_TEST_RUN_STATUSES.includes(run.Status as never);
}

/**
 * Merge freshly fetched runs over the prior list, dropping any optimistic placeholder row
 * once the real record for the same async job id has arrived. Ids are compared on the
 * 15-character prefix since runTestsAsynchronous returns 15-char ids and queries return 18-char.
 */
export function mergeRuns(priorRuns: ApexTestRunResultRecord[], fetchedRuns: ApexTestRunResultRecord[]): ApexTestRunResultRecord[] {
  const fetchedJobIds = new Set(fetchedRuns.map((run) => run.AsyncApexJobId.slice(0, 15)));
  const retainedPriorRuns = priorRuns.filter(
    (run) => !run.Id.startsWith('optimistic-') || !fetchedJobIds.has(run.AsyncApexJobId.slice(0, 15)),
  );
  return orderBy(Object.values({ ...groupByFlat(retainedPriorRuns, 'Id'), ...groupByFlat(fetchedRuns, 'Id') }), ['CreatedDate'], ['desc']);
}

/**
 * Poll recent test runs for the org. Runs are not filtered by user, so runs started
 * outside Jetstream (Dev Console, VS Code, CI) show up while in progress.
 * Polls faster while any listed run is still executing.
 */
export function useApexTestRunsList(org: SalesforceOrgUi) {
  const isMounted = useRef(true);
  /** If multiple requests overlap, ignore results from any request that is no longer the latest */
  const currentFetchToken = useRef<number>(0);
  /**
   * Must be state, not a ref — a failed poll may not otherwise re-render (the error message is
   * often unchanged between failures), and the cutoff below only engages on re-render.
   */
  const [numPollErrors, setNumPollErrors] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [runs, setRuns] = useState<ApexTestRunResultRecord[]>([]);
  const [lastChecked, setLastChecked] = useState<Date>();

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchRuns = useCallback(
    async (clearPrevious?: boolean) => {
      const fetchToken = new Date().getTime();
      try {
        currentFetchToken.current = fetchToken;
        setErrorMessage(null);
        const records = await fetchTestRuns(org);
        if (isMounted.current && fetchToken === currentFetchToken.current) {
          setNumPollErrors(0);
          if (clearPrevious) {
            setRuns(records);
          } else {
            // Merge instead of replace so optimistic rows and rows that fell out of the
            // LIMIT window are retained until the org data catches up
            setRuns((priorRuns) => mergeRuns(priorRuns, records));
          }
          setLoading(false);
          setLastChecked(new Date());
        } else if (fetchToken !== currentFetchToken.current) {
          logger.info('[APEX TESTS][RUNS] ignoring results, currentFetchToken is not valid');
        }
      } catch (ex) {
        // Only count failures from the latest request so a slow, superseded fetch cannot skew the cutoff
        if (isMounted.current && fetchToken === currentFetchToken.current) {
          setNumPollErrors((priorCount) => priorCount + 1);
          setErrorMessage(getErrorMessage(ex));
          setLoading(false);
        }
      }
    },
    [org],
  );

  /**
   * Insert a synthetic Queued row immediately after launching a run so the UI responds
   * before the first poll finds the real ApexTestRunResult. The merge in fetchRuns replaces
   * it once the real record (matched by scanning AsyncApexJobId) arrives.
   */
  const addOptimisticRun = useCallback((asyncApexJobId: string, userId: string) => {
    const optimisticRun: ApexTestRunResultRecord = {
      Id: `optimistic-${asyncApexJobId}`,
      AsyncApexJobId: asyncApexJobId,
      Status: 'Queued',
      ClassesEnqueued: 0,
      ClassesCompleted: null,
      MethodsEnqueued: null,
      MethodsCompleted: null,
      MethodsFailed: null,
      StartTime: null,
      EndTime: null,
      TestTime: null,
      UserId: userId,
      User: null,
      CreatedDate: new Date().toISOString(),
    };
    setRuns((priorRuns) => [optimisticRun, ...priorRuns]);
  }, []);

  const handlePoll = useCallback(() => {
    !isPaused && fetchRuns();
  }, [isPaused, fetchRuns]);

  const togglePause = useCallback(() => {
    setIsPaused((prevValue) => !prevValue);
  }, []);

  const hasRunsInProgress = runs.some(isTestRunInProgress);
  // Stop polling entirely after sustained failures (dead org/session) — a successful manual refresh resets the count
  const intervalDelay = numPollErrors >= MAX_POLL_ERRORS ? null : hasRunsInProgress ? ACTIVE_POLL_INTERVAL : IDLE_POLL_INTERVAL;

  useInterval(handlePoll, intervalDelay);

  useNonInitialEffect(() => {
    setRuns([]);
    setLoading(true);
  }, [org]);

  useEffect(() => {
    setNumPollErrors(0);
    fetchRuns();
  }, [fetchRuns]);

  return { runs, loading, errorMessage, lastChecked, isPaused, togglePause, fetchRuns, addOptimisticRun, hasRunsInProgress };
}
