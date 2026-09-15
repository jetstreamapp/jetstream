import { logger } from '@jetstream/shared/client-logger';
import { getOrgs, onOrgActivity } from '@jetstream/shared/data';
import { fromAppState } from '@jetstream/ui/app-state';
import { useSetAtom } from 'jotai';
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
export const OrgActivitySync: FunctionComponent = () => {
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

  const setOrgs = useSetAtom(fromAppState.salesforceOrgsState);
  const dayLastSeen = useRef(new Date().toDateString());

  /**
   * Expiration is measured in whole days, so a countdown rendered yesterday is wrong today and nothing
   * would recompute it - a tab left open overnight kept counting down from the day it was opened, and
   * an org that expired in the meantime kept its non-error styling.
   *
   * Refreshing on the day rolling over rather than on every tab switch keeps this to at most one request
   * per day per tab, and picks up anything else that changed server-side while the tab was away. A tab
   * that stays visible across midnight is not covered - it has no event to hang this off.
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      const today = new Date().toDateString();
      if (document.visibilityState !== 'visible' || today === dayLastSeen.current) {
        return;
      }
      dayLastSeen.current = today;
      getOrgs()
        .then(setOrgs)
        .catch((error) => logger.warn('Error refreshing orgs after the calendar day changed', error));
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [setOrgs]);

  return null;
};
