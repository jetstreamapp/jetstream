import { onOrgActivity } from '@jetstream/shared/data';
import { fromAppState } from '@jetstream/ui/app-state';
import { useAtomCallback } from 'jotai/utils';
import { FunctionComponent, useCallback, useEffect } from 'react';
import { calculateOrgExpiration } from './useOrgExpiration';

/**
 * Keeps the locally held expiration state of an org in step with what the server has already done.
 *
 * Using an org resets its inactivity clock server-side, but the response carries no indication of it,
 * so an org that was showing an expiration warning kept showing it for the rest of the session even
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

  return null;
};
