import { logger } from '@jetstream/shared/client-logger';
import { query } from '@jetstream/shared/data';
import { getApexLogsQuery, useInterval, useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { getErrorMessage, groupByFlat } from '@jetstream/shared/utils';
import { ApexLog, SalesforceOrgUi, UseDebugLogsOptions } from '@jetstream/types';
import orderBy from 'lodash/orderBy';
import { useCallback, useEffect, useRef, useState } from 'react';

const DEFAULT_POLL_INTERVAL = 10000; // 10 seconds
const MAX_POLL_ATTEMPTS = 25;

export function useDebugLogs(org: SalesforceOrgUi, { limit, pollInterval, userId }: UseDebugLogsOptions) {
  pollInterval = pollInterval || DEFAULT_POLL_INTERVAL;
  const isMounted = useRef(true);
  /** Used so that if multiple requests come in at about the same time, we can ignore results from intermediate requests as they may not be valid */
  const currentFetchToken = useRef<number>(new Date().getTime());
  const numPollErrors = useRef<number>(0);
  const [isPaused, setIsPaused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [logs, setLogs] = useState<ApexLog[]>([]);
  /** If provided, will only fetch the most resent logs */
  const [asOfId, setAsOfId] = useState<string | null>(null);
  const [intervalDelay, setIntervalDelay] = useState<number | null>(null);
  const [lastChecked, setLastChecked] = useState<Date>();

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchLogs = useCallback(
    async (clearPrevious?: boolean) => {
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
          if (clearPrevious) {
            setLogs(queryResults.records);
          } else {
            setLogs((logs) =>
              orderBy(
                Object.values({ ...groupByFlat(logs, 'Id'), ...groupByFlat(queryResults.records, 'Id') }),
                ['LastModifiedDate'],
                ['desc']
              )
            );
          }
          setLoading(false);
          setLastChecked(new Date());
          if (pollInterval !== intervalDelay) {
            setIntervalDelay(pollInterval || null);
          }
        } else if (fetchToken !== currentFetchToken.current) {
          logger.info('[APEX LOGS][LOG RESULTS] ignoring results, currentFetchToken is not valid');
        }
      } catch (ex) {
        if (isMounted.current) {
          numPollErrors.current++;
          if (fetchToken === currentFetchToken.current) {
            // TODO: what should we do if we cannot fetch logs?
            setErrorMessage(getErrorMessage(ex));
            setLoading(false);
          }
        }
      }
    },
    [org, asOfId, limit, userId, pollInterval, intervalDelay]
  );

  const handlePoll = useCallback(() => {
    !isPaused && fetchLogs();
  }, [isPaused, fetchLogs]);

  const togglePause = useCallback(() => {
    setIsPaused((prevValue) => !prevValue);
  }, []);

  useInterval(handlePoll, numPollErrors.current > MAX_POLL_ATTEMPTS ? null : intervalDelay);

  useNonInitialEffect(() => {
    setLogs([]);
    setAsOfId(null);
  }, [org]);

  useNonInitialEffect(() => {
    fetchLogs();
    setErrorMessage(null);
    numPollErrors.current = 0;
  }, [fetchLogs, org]);

  return { togglePause, fetchLogs, isPaused, loading, lastChecked, logs, pollInterval, errorMessage };
}
