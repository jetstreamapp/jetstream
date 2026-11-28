import { useInterval } from '@jetstream/shared/ui-utils';
import { getErrorMessage } from '@jetstream/shared/utils';
import type { SalesforceOrgUi, ScratchOrgInfoRecord } from '@jetstream/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchScratchOrgLimits, fetchScratchOrgs, NotDevHubError } from './scratch-org-data.utils';
import type { DevHubScratchOrgLimits } from './scratch-org.types';
import { isScratchOrgPending } from './scratch-org.utils';

/** While a scratch org is being created its status is checked often, signup usually takes a minute or two */
const ACTIVE_POLL_INTERVAL = 5000;
/** Kept slow, every check counts against the Dev Hub's daily API request limit */
const IDLE_POLL_INTERVAL = 120000;
const MAX_POLL_ERRORS = 10;
/** A request stuck in New or Creating for longer than this is not worth polling quickly for */
const RECENTLY_REQUESTED_MS = 1000 * 60 * 20;

const EMPTY_LIMITS: DevHubScratchOrgLimits = { active: null, daily: null };

function isRecentlyRequested({ CreatedDate }: ScratchOrgInfoRecord): boolean {
  const createdTime = CreatedDate ? new Date(CreatedDate).getTime() : NaN;
  return Number.isNaN(createdTime) || Date.now() - createdTime < RECENTLY_REQUESTED_MS;
}

/**
 * The scratch orgs of a Dev Hub, kept up to date by polling. Scratch orgs created or deleted elsewhere
 * (the Salesforce CLI, CI) show up without a manual refresh.
 */
export function useScratchOrgs(devHubOrg: SalesforceOrgUi, includeDeleted: boolean) {
  /**
   * The org object is replaced whenever the list of orgs is refetched (e.g. after a scratch org is connected), so
   * everything here is keyed on its id and reads the latest object through this ref.
   */
  const devHubOrgRef = useRef(devHubOrg);
  /** Results of a request are ignored once the Dev Hub or filter it was made for is no longer current */
  const generation = useRef(0);
  const isFetching = useRef(false);
  const [records, setRecords] = useState<ScratchOrgInfoRecord[]>([]);
  const [limits, setLimits] = useState<DevHubScratchOrgLimits>(EMPTY_LIMITS);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isNotDevHub, setIsNotDevHub] = useState(false);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);
  // State rather than a ref so that reaching the cutoff re-renders and stops the interval
  const [numPollErrors, setNumPollErrors] = useState(0);

  useEffect(() => {
    devHubOrgRef.current = devHubOrg;
  }, [devHubOrg]);

  const devHubOrgId = devHubOrg.uniqueId;

  const fetchLatest = useCallback(
    async ({ includeLimits }: { includeLimits: boolean }) => {
      const requestGeneration = generation.current;
      const isCurrent = () => requestGeneration === generation.current;
      isFetching.current = true;
      setRefreshing(true);
      try {
        const [scratchOrgs, scratchOrgLimits] = await Promise.all([
          fetchScratchOrgs(devHubOrgRef.current, { includeDeleted }),
          includeLimits ? fetchScratchOrgLimits(devHubOrgRef.current) : null,
        ]);
        if (!isCurrent()) {
          return;
        }
        setRecords(scratchOrgs.records);
        setHasMore(scratchOrgs.hasMore);
        if (scratchOrgLimits) {
          setLimits(scratchOrgLimits);
        }
        setErrorMessage(null);
        setIsNotDevHub(false);
        setNumPollErrors(0);
        setLastChecked(new Date());
      } catch (ex) {
        if (!isCurrent()) {
          return;
        }
        setNumPollErrors((priorCount) => priorCount + 1);
        if (ex instanceof NotDevHubError) {
          setIsNotDevHub(true);
          setRecords([]);
          setErrorMessage(null);
        } else {
          setErrorMessage(getErrorMessage(ex));
        }
      } finally {
        if (isCurrent()) {
          isFetching.current = false;
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    // devHubOrgId is a dependency so that a new Dev Hub gets a new function, which is what restarts the effect below
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [devHubOrgId, includeDeleted],
  );

  /** Refresh on demand: after a change was made, or when the user asks */
  const refresh = useCallback(() => fetchLatest({ includeLimits: true }), [fetchLatest]);

  // Start over whenever the Dev Hub or the filter changes, the prior results describe something else
  useEffect(() => {
    const generationRef = generation;
    generationRef.current++;
    isFetching.current = false;
    setRecords([]);
    setLimits(EMPTY_LIMITS);
    setHasMore(false);
    setLoading(true);
    setIsNotDevHub(false);
    setErrorMessage(null);
    setNumPollErrors(0);
    fetchLatest({ includeLimits: true });
    return () => {
      // Results of a request for the prior Dev Hub must not land after the switch
      generationRef.current++;
    };
  }, [fetchLatest]);

  // Other people's stale requests should not keep everyone polling quickly
  const hasPendingScratchOrgs = records.some((record) => isScratchOrgPending(record) && isRecentlyRequested(record));

  const poll = useCallback(() => {
    // A slow response must not be discarded by the next tick, and a hidden tab has nobody to show changes to
    if (isFetching.current || document.hidden) {
      return;
    }
    // Limits only move when a scratch org is created or deleted, the quick status checks leave them alone
    fetchLatest({ includeLimits: !hasPendingScratchOrgs });
  }, [fetchLatest, hasPendingScratchOrgs]);

  // An org that is not a Dev Hub will not become one, and sustained failures mean a dead session
  const shouldPoll = !isNotDevHub && numPollErrors < MAX_POLL_ERRORS;
  useInterval(poll, shouldPoll ? (hasPendingScratchOrgs ? ACTIVE_POLL_INTERVAL : IDLE_POLL_INTERVAL) : null);

  return { records, limits, hasMore, loading, refreshing, errorMessage, isNotDevHub, lastChecked, refresh };
}
