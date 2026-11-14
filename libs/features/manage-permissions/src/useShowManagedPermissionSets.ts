import { logger } from '@jetstream/shared/client-logger';
import { setItemInLocalStorage } from '@jetstream/shared/ui-utils';
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
 * flag and its persistence to local storage.
 */
export function useShowManagedPermissionSets() {
  const [showManagedPermissionSets, setShowManagedPermissionSets] = useState<boolean>(getStoredShowManagedPermissionSets);

  const toggleShowManagedPermissionSets = useCallback((visible: boolean) => {
    setShowManagedPermissionSets(visible);
    setItemInLocalStorage(STORAGE_KEYS.PERMISSION_MANAGER_SHOW_MANAGED_PERM_SETS, String(visible));
  }, []);

  return { showManagedPermissionSets, toggleShowManagedPermissionSets };
}
