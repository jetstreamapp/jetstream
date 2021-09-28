import { logger } from '@jetstream/shared/client-logger';
import { query } from '@jetstream/shared/data';
import { getApexLogsQuery, useInterval, useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { ApexLog, SalesforceOrgUi, UseDebugLogsOptions } from '@jetstream/types';
import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_POLL_INTERVAL = 10000; // 10 seconds
const MAX_POLL_ATTEMPTS = 25;

export function useDebugLogs(org: SalesforceOrgUi, { limit, pollInterval, userId }: UseDebugLogsOptions) {
  pollInterval = pollInterval || DEFAULT_POLL_INTERVAL;
  const isMounted = useRef(null);
  /** Used so that if multiple requests come in at about the same time, we can ignore results from intermediate requests as they may not be valid */
  const currentFetchToken = useRef<number>(new Date().getTime());
  const numPollErrors = useRef<number>(0);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState();
  const [logs, setLogs] = useState<ApexLog[]>([]);
  /** If provided, will only fetch the most resent logs */
  const [asOfId, setAsOfId] = useState<string>(null);
  const [intervalDelay, setIntervalDelay] = useState<number | null>(null);
  const [lastChecked, setLastChecked] = useState<Date>();

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handlePoll = useCallback(() => {
    fetchLogs();
  }, [org, userId]);

  useInterval(handlePoll, numPollErrors.current > MAX_POLL_ATTEMPTS ? null : intervalDelay);

  useNonInitialEffect(() => {
    setAsOfId(null);
  }, [userId]);

  useNonInitialEffect(() => {
    setLogs([]);
    setAsOfId(null);
    fetchLogs();
    setErrorMessage(null);
    numPollErrors.current = 0;
  }, [org]);

  const fetchLogs = useCallback(async () => {
    const fetchToken = new Date().getTime();
    try {
      setLoading(true);
      setErrorMessage(null);
      currentFetchToken.current = fetchToken;
      const { queryResults } = await query<ApexLog>(
        org,
        getApexLogsQuery({
          asOfId,
          limit,
          userId,
        })
      );
      if (isMounted.current && fetchToken === currentFetchToken.current) {
        setLogs(queryResults.records);
        setLoading(false);
        setLastChecked(new Date());
        if (pollInterval !== intervalDelay) {
          setIntervalDelay(pollInterval);
        }
      } else if (fetchToken !== currentFetchToken.current) {
        logger.info('[APEX LOGS][LOG RESULTS] ignoring results, currentFetchToken is not valid');
      }
    } catch (ex) {
      if (isMounted.current) {
        numPollErrors.current++;
        if (fetchToken === currentFetchToken.current) {
          // TODO: what should we do if we cannot fetch logs?
          setErrorMessage(ex.message);
          setLoading(false);
        }
      }
    }
  }, [org, limit, userId, pollInterval, intervalDelay]);

  return { fetchLogs, loading, lastChecked, logs, pollInterval, errorMessage };
}
