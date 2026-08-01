import { SalesforceOrgUi } from '@jetstream/types';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getPermissionableSobjects } from './utils/permission-manager-utils';

/**
 * Loads the set of objects that can have an `ObjectPermissions` record in the selected org.
 *
 * `permissionableSobjects` is `null` when the allow-list could not be determined, which callers treat
 * as "fall back to the heuristic filter" rather than "no objects". `loading` stays `true` until the
 * fetch for the current org settles, so the object list is never populated with a stale filter.
 */
export function usePermissionableSobjects(selectedOrg: SalesforceOrgUi) {
  const isMounted = useRef(true);
  const [refreshCount, setRefreshCount] = useState(0);
  const [loaded, setLoaded] = useState<{ key: string; permissionableSobjects: Set<string> | null } | null>(null);

  const orgUniqueId = selectedOrg?.uniqueId || null;
  // Changing the key marks the current results stale without a synchronous state update
  const key = `${orgUniqueId}:${refreshCount}`;

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    let canceled = false;
    const results = orgUniqueId ? getPermissionableSobjects(selectedOrg) : Promise.resolve(null);
    results.then((permissionableSobjects) => {
      if (!canceled && isMounted.current) {
        setLoaded({ key, permissionableSobjects });
      }
    });
    return () => {
      canceled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const isLoaded = loaded?.key === key;

  return {
    permissionableSobjects: isLoaded ? loaded.permissionableSobjects : null,
    loading: !isLoaded,
    refresh: useCallback(() => setRefreshCount((count) => count + 1), []),
  };
}
