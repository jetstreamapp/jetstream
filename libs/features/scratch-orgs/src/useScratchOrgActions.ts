import { SCRATCH_ORG_NOT_REACHABLE_MESSAGE } from '@jetstream/api-types';
import { logger } from '@jetstream/shared/client-logger';
import { connectScratchOrg, deleteOrg, getOrgs } from '@jetstream/shared/data';
import { delay, getErrorMessage } from '@jetstream/shared/utils';
import type { SalesforceOrgUi, ScratchOrgInfoRecord } from '@jetstream/types';
import { fireToast } from '@jetstream/ui';
import { deleteAllHistoryRecords } from '@jetstream/ui-core';
import { applicationCookieState, salesforceOrgsState } from '@jetstream/ui/app-state';
import { useAtomValue, useSetAtom } from 'jotai';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { deleteScratchOrg } from './scratch-org-data.utils';
import { deployScratchOrgSettings, hasScratchOrgSettings } from './scratch-org-settings.utils';
import type { PendingScratchOrg } from './scratch-org.types';
import { getSignupErrorMessage } from './scratch-org.utils';

/** A new scratch org's My Domain can take a few minutes to resolve, the CLI waits up to three */
const CONNECT_RETRY_DELAY = 15000;
const MAX_CONNECT_ATTEMPTS = 12;

export type PendingScratchOrgStep = 'creating' | 'connecting' | 'deploying-settings';

/** A scratch org that was requested from this page, and how far along the work that follows its creation is */
interface PendingEntry {
  scratchOrg: PendingScratchOrg;
  step: PendingScratchOrgStep;
}

/** A scratch org that cannot be reached yet can be tried again, every other refusal to connect it is final */
export function isNotReachableYet(ex: unknown): boolean {
  return getErrorMessage(ex).startsWith(SCRATCH_ORG_NOT_REACHABLE_MESSAGE);
}

/** Ids of the rows that an action is running for, so that the row can show it and block a second click */
function useBusyIds() {
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const setBusy = useCallback((id: string, isBusy: boolean) => {
    setBusyIds((priorIds) => {
      const ids = new Set(priorIds);
      if (isBusy) {
        ids.add(id);
      } else {
        ids.delete(id);
      }
      return ids;
    });
  }, []);

  const reset = useCallback(() => setBusyIds(new Set()), []);

  return { busyIds, setBusy, reset };
}

/**
 * Connecting, deleting and finishing the setup of scratch orgs.
 *
 * Salesforce creates a scratch org asynchronously, so one requested from this page is tracked as "pending" until it
 * is active. It is then connected to Jetstream and the settings of its definition are deployed, which is the work the
 * Salesforce CLI does after `sf org create scratch`. That only happens while this page stays open on the same Dev Hub;
 * a scratch org left behind can be connected from the list, but its settings are not deployed.
 */
export function useScratchOrgActions(devHubOrg: SalesforceOrgUi, records: ScratchOrgInfoRecord[], refresh: () => Promise<void>) {
  const isMounted = useRef(true);
  /** The org object is replaced whenever the list of orgs is refetched, which connecting a scratch org does */
  const devHubOrgRef = useRef(devHubOrg);
  const { defaultApiVersion } = useAtomValue(applicationCookieState);
  const setOrgs = useSetAtom(salesforceOrgsState);
  /** Keyed by the id of the ScratchOrgInfo */
  const [pending, setPending] = useState<Record<string, PendingEntry>>({});
  const pendingRef = useRef(pending);
  const { busyIds: connectingIds, setBusy: setConnecting, reset: resetConnecting } = useBusyIds();
  const { busyIds: deletingIds, setBusy: setDeleting, reset: resetDeleting } = useBusyIds();
  /**
   * Pending scratch orgs whose post-create work has started, so a later poll does not start it again.
   * Not derived from the step: the list can be polled again before the step that marks the start is committed.
   */
  const startedIds = useRef(new Set<string>());

  const pendingSteps = useMemo(
    () => Object.fromEntries(Object.entries(pending).map(([scratchOrgInfoId, { step }]) => [scratchOrgInfoId, step])),
    [pending],
  );

  useEffect(() => {
    devHubOrgRef.current = devHubOrg;
  }, [devHubOrg]);

  useEffect(() => {
    pendingRef.current = pending;
  }, [pending]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  // Pending work belongs to the Dev Hub it was started on
  useEffect(() => {
    return () => {
      const abandonedNames = Object.values(pendingRef.current)
        .filter(({ scratchOrg }) => scratchOrg.connect)
        .map(({ scratchOrg }) => `"${scratchOrg.orgName}"`);
      if (abandonedNames.length) {
        fireToast({
          type: 'warning',
          message: `Jetstream stopped waiting for ${abandonedNames.join(', ')}. Salesforce is still creating it, connect it from the Scratch Orgs page once it is active.`,
        });
      }
      setPending({});
      resetConnecting();
      resetDeleting();
      startedIds.current = new Set();
    };
  }, [devHubOrg.uniqueId, resetConnecting, resetDeleting]);

  /**
   * Work that outlives a request (waiting for a scratch org, deploying its settings) is abandoned when the user
   * leaves the page or switches to another Dev Hub. Call this when the work starts, then the returned check as it goes.
   */
  const createAbandonCheck = useCallback(() => {
    const devHubOrgId = devHubOrgRef.current.uniqueId;
    return () => !isMounted.current || devHubOrgRef.current.uniqueId !== devHubOrgId;
  }, []);

  /**
   * The server is the source of truth for the list of orgs. Refetching (rather than patching the list in memory)
   * keeps the Dev Hub selected and cannot work from a stale copy of the list.
   */
  const refetchOrgs = useCallback(async () => {
    try {
      setOrgs(await getOrgs());
    } catch (ex) {
      logger.warn('[SCRATCH ORG] Unable to refresh the list of orgs', getErrorMessage(ex));
    }
  }, [setOrgs]);

  /**
   * Connect a scratch org that was created with Jetstream, no password required.
   * @param waitUntilReachable keep trying while the scratch org cannot be reached, for one that was just created
   */
  const connect = useCallback(
    async (scratchOrgInfoId: string, { waitUntilReachable = false }: { waitUntilReachable?: boolean } = {}): Promise<SalesforceOrgUi> => {
      const isAbandoned = createAbandonCheck();
      setConnecting(scratchOrgInfoId, true);
      try {
        for (let attempt = 1; ; attempt++) {
          try {
            const scratchOrg = await connectScratchOrg(devHubOrgRef.current, scratchOrgInfoId);
            await refetchOrgs();
            return scratchOrg;
          } catch (ex) {
            if (!waitUntilReachable || !isNotReachableYet(ex) || attempt >= MAX_CONNECT_ATTEMPTS) {
              throw ex;
            }
            logger.info('[SCRATCH ORG] Not reachable yet, trying again', { scratchOrgInfoId, attempt });
            await delay(CONNECT_RETRY_DELAY);
            if (isAbandoned()) {
              throw ex;
            }
          }
        }
      } finally {
        if (!isAbandoned()) {
          setConnecting(scratchOrgInfoId, false);
        }
      }
    },
    [createAbandonCheck, refetchOrgs, setConnecting],
  );

  /** Delete a scratch org from the Dev Hub, along with its (now useless) connections in Jetstream */
  const remove = useCallback(
    async (scratchOrg: Pick<ScratchOrgInfoRecord, 'Id' | 'Status'>, connectedOrgs: SalesforceOrgUi[]) => {
      const isAbandoned = createAbandonCheck();
      setDeleting(scratchOrg.Id, true);
      try {
        await deleteScratchOrg(devHubOrgRef.current, scratchOrg);
        for (const connectedOrg of connectedOrgs) {
          try {
            await deleteOrg(connectedOrg);
            deleteAllHistoryRecords(connectedOrg);
          } catch (ex) {
            // The scratch org is gone either way, a stale connection can be removed from the org list
            logger.warn('[SCRATCH ORG] Unable to remove the connection of a deleted scratch org', getErrorMessage(ex));
          }
        }
        if (connectedOrgs.length) {
          await refetchOrgs();
        }
        await refresh();
      } finally {
        if (!isAbandoned()) {
          setDeleting(scratchOrg.Id, false);
        }
      }
    },
    [createAbandonCheck, refetchOrgs, refresh, setDeleting],
  );

  const trackPendingScratchOrg = useCallback((scratchOrg: PendingScratchOrg) => {
    setPending((priorPending) => ({ ...priorPending, [scratchOrg.scratchOrgInfoId]: { scratchOrg, step: 'creating' } }));
  }, []);

  const stopTracking = useCallback((scratchOrgInfoId: string) => {
    setPending(({ [scratchOrgInfoId]: _finished, ...remaining }) => remaining);
  }, []);

  const finishPendingScratchOrg = useCallback(
    async ({ scratchOrgInfoId, orgName, connect: shouldConnect, settings, objectSettings }: PendingScratchOrg) => {
      // The Dev Hub switch already told the user that the wait was over
      const isAbandoned = createAbandonCheck();
      const setStep = (step: PendingScratchOrgStep) => {
        if (!isAbandoned()) {
          // Nothing to update once it is no longer tracked
          setPending((priorPending) =>
            priorPending[scratchOrgInfoId]
              ? { ...priorPending, [scratchOrgInfoId]: { ...priorPending[scratchOrgInfoId], step } }
              : priorPending,
          );
        }
      };
      try {
        if (!shouldConnect) {
          fireToast({ type: 'success', message: `Scratch org "${orgName}" is ready.` });
          return;
        }
        setStep('connecting');
        let scratchOrg: SalesforceOrgUi;
        try {
          scratchOrg = await connect(scratchOrgInfoId, { waitUntilReachable: true });
        } catch (ex) {
          if (!isAbandoned()) {
            fireToast({
              type: 'warning',
              message: `Scratch org "${orgName}" was created, but it could not be connected to Jetstream. ${getErrorMessage(ex)}`,
            });
          }
          return;
        }
        if (hasScratchOrgSettings(settings, objectSettings)) {
          setStep('deploying-settings');
          try {
            await deployScratchOrgSettings(scratchOrg, { settings, objectSettings, apiVersion: defaultApiVersion.replace('v', '') });
          } catch (ex) {
            fireToast({
              type: 'warning',
              message: `Scratch org "${orgName}" was created and connected, but its settings could not be deployed. ${getErrorMessage(ex)}`,
            });
            return;
          }
        }
        fireToast({ type: 'success', message: `Scratch org "${orgName}" is ready and connected to Jetstream.` });
      } finally {
        if (!isAbandoned()) {
          stopTracking(scratchOrgInfoId);
        }
      }
    },
    [connect, createAbandonCheck, defaultApiVersion, stopTracking],
  );

  // Pick up pending scratch orgs once Salesforce reports the outcome of the signup
  useEffect(() => {
    Object.values(pending).forEach(({ scratchOrg: pendingScratchOrg }) => {
      const { scratchOrgInfoId, orgName } = pendingScratchOrg;
      const record = records.find(({ Id }) => Id.slice(0, 15) === scratchOrgInfoId.slice(0, 15));
      if (!record || startedIds.current.has(scratchOrgInfoId)) {
        return;
      }
      if (record.Status === 'Active') {
        startedIds.current.add(scratchOrgInfoId);
        finishPendingScratchOrg(pendingScratchOrg);
      } else if (record.Status === 'Error' || record.Status === 'Deleted') {
        startedIds.current.add(scratchOrgInfoId);
        fireToast({ type: 'error', message: `Scratch org "${orgName}" could not be created. ${getSignupErrorMessage(record.ErrorCode)}` });
        stopTracking(scratchOrgInfoId);
      }
    });
  }, [finishPendingScratchOrg, pending, records, stopTracking]);

  return { connect, remove, refetchOrgs, trackPendingScratchOrg, pendingSteps, connectingIds, deletingIds };
}
