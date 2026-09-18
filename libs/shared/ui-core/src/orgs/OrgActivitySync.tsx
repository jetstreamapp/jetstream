import { logger } from '@jetstream/shared/client-logger';
import { getOrgs, onOrgActivity } from '@jetstream/shared/data';
import { fromAppState } from '@jetstream/ui/app-state';
import { useAtomCallback } from 'jotai/utils';
import { FunctionComponent, useCallback, useEffect, useRef } from 'react';
import { calculateOrgExpiration } from './useOrgExpiration';

/**
 * Keeps the locally held expiration state of an org in step with what the server has already done.
 *
 * Using an org resets its inactivity clock server-side, but the response body carries no indication of
 * it, so an org that was showing an expiration warning kept showing it for the rest of the session even
 * though the warning was no longer true. Recording the activity locally makes the warning clear itself
 * the moment the org is used, matching what a page reload would show.
 */
/**
 * Shared across instances so the day's refresh is one request, not one per mounted component -
 * `OrgsDropdown` mounts this, and the header and the "select an org" prompt can both render a dropdown
 * at the same time, so two instances see the same visibility change.
 */
let refreshInFlight: Promise<void> | null = null;

export const OrgActivitySync: FunctionComponent = () => {
  const dayLastSeen = useRef(new Date().toDateString());
  const recordOrgActivity = useAtomCallback(
    useCallback((get, set, uniqueId: string) => {
      const orgs = get(fromAppState.salesforceOrgsState);
      /**
       * Only orgs whose displayed state is driven by the inactivity clock are worth touching. Every
       * request would otherwise replace the org array, re-rendering every consumer of it for a change
       * nobody can see - and an org stuck on a `connectionError` would do so on every single request,
       * since recording activity does not resolve that error.
       */
      const isDrivenByInactivity = orgs.some((org) => {
        if (org.uniqueId !== uniqueId) {
          return false;
        }
        /**
         * An org that predates `lastActivityAt` has no date to count from, so nothing about it is
         * day-dependent and the daily refresh skips it entirely. The server writes the column as part
         * of confirming this very activity, so recording it here is what gets such an org onto the
         * clock at all - and only ever once, since the guards above and below then apply.
         */
        if (!org.lastActivityAt) {
          return true;
        }
        const { status } = calculateOrgExpiration(org);
        return status === 'expiring' || status === 'disconnected';
      });
      if (!isDrivenByInactivity) {
        return;
      }
      /**
       * `connectionError` is deliberately left alone - only a health check establishes that an error is
       * gone, and the error middleware owns that field.
       */
      set(
        fromAppState.salesforceOrgsState,
        orgs.map((org) =>
          org.uniqueId === uniqueId ? { ...org, lastActivityAt: new Date().toISOString(), expirationScheduledFor: null } : org,
        ),
      );
    }, []),
  );

  useEffect(() => onOrgActivity(({ uniqueId }) => recordOrgActivity(uniqueId)), [recordOrgActivity]);

  /**
   * Expiration is measured in whole days, so a countdown rendered yesterday is wrong today and nothing
   * would recompute it - a tab left open overnight kept counting down from the day it was opened, and
   * an org that expired in the meantime kept its non-error styling.
   *
   * Refreshing on the day rolling over rather than on every tab switch keeps this to at most one request
   * per day per tab, and picks up anything else that changed server-side while the tab was away. A tab
   * that stays visible across midnight is not covered - it has no event to hang this off.
   */
  const refreshOrgsOnNewDay = useAtomCallback(
    useCallback((get, set) => {
      /**
       * Only orgs the server tracks an inactivity deadline for have anything that changes with the date,
       * and only those apps serve a real org list: the browser extension and canvas resolve their single
       * org from the host page and answer `/api/orgs` with an empty array, so refetching there would
       * replace the active org with nothing.
       */
      const hasDayDependentOrg = get(fromAppState.salesforceOrgsState).some(
        ({ lastActivityAt, expirationScheduledFor }) => lastActivityAt || expirationScheduledFor,
      );
      if (!hasDayDependentOrg) {
        return Promise.resolve();
      }
      return getOrgs().then((refreshedOrgs) => {
        /**
         * The user can use an org while this request is in flight, which records activity locally that
         * the response predates. Taking the newer of the two stops the refresh from resurrecting a
         * warning that has already been cleared.
         */
        const activityByOrg = new Map(
          get(fromAppState.salesforceOrgsState).map(({ uniqueId, lastActivityAt }) => [uniqueId, lastActivityAt]),
        );
        set(
          fromAppState.salesforceOrgsState,
          refreshedOrgs.map((org) => {
            const localActivity = activityByOrg.get(org.uniqueId);
            const isLocalActivityNewer = localActivity && (!org.lastActivityAt || localActivity > org.lastActivityAt);
            return isLocalActivityNewer ? { ...org, lastActivityAt: localActivity, expirationScheduledFor: null } : org;
          }),
        );
      });
    }, []),
  );

  useEffect(() => {
    const handleVisibilityChange = () => {
      const today = new Date().toDateString();
      if (document.visibilityState !== 'visible' || today === dayLastSeen.current) {
        return;
      }
      if (!refreshInFlight) {
        refreshInFlight = refreshOrgsOnNewDay().finally(() => {
          refreshInFlight = null;
        });
      }
      refreshInFlight
        // Only count the day as handled once it actually was, so a transient failure can be retried
        .then(() => {
          dayLastSeen.current = today;
        })
        .catch((error) => logger.warn('Error refreshing orgs after the calendar day changed', error));
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refreshOrgsOnNewDay]);

  return null;
};
