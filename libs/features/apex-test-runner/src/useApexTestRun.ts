import { logger } from '@jetstream/shared/client-logger';
import { useInterval } from '@jetstream/shared/ui-utils';
import { getErrorMessage } from '@jetstream/shared/utils';
import type { SalesforceOrgUi } from '@jetstream/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { abortTestRun, fetchTestRunDetail } from './apex-test-runner-data.utils';
import type { TestRunDetailViewModel } from './apex-test-runner-types';
import { isTestRunInProgress } from './useApexTestRunsList';

const POLL_INITIAL_INTERVAL_MS = 3000;
const POLL_INTERVAL_STEP_MS = 250;
const POLL_MAX_INTERVAL_MS = 10000;
/** ~30 minutes of polling before the user has to explicitly resume */
const POLL_MAX_CHECKS = 200;
const MAX_POLL_ERRORS = 5;

function getPollInterval(checkCount: number): number {
  return Math.min(POLL_INITIAL_INTERVAL_MS + checkCount * POLL_INTERVAL_STEP_MS, POLL_MAX_INTERVAL_MS);
}

export interface SelectedTestRun {
  runId: string;
  asyncApexJobId: string;
}

/**
 * Poll a single test run for status, per-class queue progress, and per-method results.
 * Polling stops after one final fetch once the run reaches a terminal status, and pauses
 * with a resumable timeout state if the run outlives the polling window.
 */
export function useApexTestRun(org: SalesforceOrgUi, apiVersion: string, selectedRun: SelectedTestRun | null) {
  const isMounted = useRef(true);
  const currentFetchToken = useRef<number>(0);
  const checkCount = useRef(0);
  const numPollErrors = useRef(0);
  /** Results can lag the terminal status by a beat, so always fetch once more after seeing a terminal status */
  const sawTerminalStatus = useRef(false);
  const [detail, setDetail] = useState<TestRunDetailViewModel | null>(null);
  const [loading, setLoading] = useState(false);
  const [aborting, setAborting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pollingTimedOut, setPollingTimedOut] = useState(false);
  const [isPolling, setIsPolling] = useState(false);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchDetail = useCallback(async () => {
    if (!selectedRun || selectedRun.runId.startsWith('optimistic-')) {
      return;
    }
    const fetchToken = new Date().getTime();
    currentFetchToken.current = fetchToken;
    try {
      const results = await fetchTestRunDetail(org, selectedRun.runId, selectedRun.asyncApexJobId);
      if (!isMounted.current || fetchToken !== currentFetchToken.current) {
        logger.info('[APEX TESTS][RUN DETAIL] ignoring results, currentFetchToken is not valid');
        return;
      }
      numPollErrors.current = 0;
      setErrorMessage(null);
      setDetail(results);
      setLoading(false);
      const isTerminal = !results.run || !isTestRunInProgress(results.run);
      if (isTerminal) {
        if (sawTerminalStatus.current) {
          setIsPolling(false);
        } else {
          sawTerminalStatus.current = true;
        }
      } else {
        sawTerminalStatus.current = false;
        checkCount.current++;
        if (checkCount.current >= POLL_MAX_CHECKS) {
          setIsPolling(false);
          setPollingTimedOut(true);
        }
      }
    } catch (ex) {
      if (isMounted.current && fetchToken === currentFetchToken.current) {
        numPollErrors.current++;
        setErrorMessage(getErrorMessage(ex));
        setLoading(false);
        if (numPollErrors.current >= MAX_POLL_ERRORS) {
          setIsPolling(false);
          setPollingTimedOut(true);
        }
      }
    }
  }, [org, selectedRun]);

  // Reset and fetch whenever the selected run (or org) changes
  useEffect(() => {
    setDetail(null);
    setErrorMessage(null);
    setPollingTimedOut(false);
    checkCount.current = 0;
    numPollErrors.current = 0;
    sawTerminalStatus.current = false;
    if (selectedRun && !selectedRun.runId.startsWith('optimistic-')) {
      setLoading(true);
      setIsPolling(true);
      fetchDetail();
    } else {
      setLoading(false);
      setIsPolling(false);
    }
  }, [fetchDetail, selectedRun]);

  useInterval(fetchDetail, isPolling ? getPollInterval(checkCount.current) : null);

  const resumePolling = useCallback(() => {
    checkCount.current = 0;
    numPollErrors.current = 0;
    setPollingTimedOut(false);
    setErrorMessage(null);
    setIsPolling(true);
    fetchDetail();
  }, [fetchDetail]);

  /** Abort remaining tests — the currently executing class still finishes */
  const abort = useCallback(async () => {
    if (!selectedRun) {
      return;
    }
    try {
      setAborting(true);
      await abortTestRun(org, apiVersion, selectedRun.asyncApexJobId);
      sawTerminalStatus.current = false;
      setIsPolling(true);
      await fetchDetail();
    } catch (ex) {
      if (isMounted.current) {
        setErrorMessage(getErrorMessage(ex));
      }
    } finally {
      if (isMounted.current) {
        setAborting(false);
      }
    }
  }, [org, apiVersion, selectedRun, fetchDetail]);

  return { detail, loading, aborting, errorMessage, pollingTimedOut, isPolling, resumePolling, abort, refresh: fetchDetail };
}
