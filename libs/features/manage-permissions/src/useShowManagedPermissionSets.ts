import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { setItemInLocalStorage } from '@jetstream/shared/ui-utils';
import { useAmplitude } from '@jetstream/ui-core';
import { STORAGE_KEYS } from '@jetstream/ui/app-state';
import { useCallback, useState } from 'react';

/**
 * A stale or hand-edited value should not break the page, so anything unparseable falls back to hidden.
 */
function getStoredShowManagedPermissionSets(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEYS.PERMISSION_MANAGER_SHOW_MANAGED_PERM_SETS) === 'true';
  } catch (ex) {
    logger.warn('[MANAGE PERMISSIONS] Could not read stored managed permission set preference', ex);
    return false;
  }
}

/**
 * Owns whether permission sets from installed managed packages are offered for selection: the in-memory
 * flag, its persistence to local storage, and the analytics event fired on every change.
 */
export function useShowManagedPermissionSets() {
  const { trackEvent } = useAmplitude();
  const [showManagedPermissionSets, setShowManagedPermissionSets] = useState<boolean>(getStoredShowManagedPermissionSets);

  const toggleShowManagedPermissionSets = useCallback(
    (visible: boolean) => {
      setShowManagedPermissionSets(visible);
      setItemInLocalStorage(STORAGE_KEYS.PERMISSION_MANAGER_SHOW_MANAGED_PERM_SETS, String(visible));
      trackEvent(ANALYTICS_KEYS.permission_manager_managed_perm_sets_toggled, { visible });
    },
    [trackEvent],
  );

  return { showManagedPermissionSets, toggleShowManagedPermissionSets };
}
