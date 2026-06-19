import { logger } from '@jetstream/shared/client-logger';
import { setItemInLocalStorage, setItemInSessionStorage } from '@jetstream/shared/ui-utils';
import { ActiveOrgGroupState, orgGroupsResolvedState, selectedOrgIdState, STORAGE_KEYS } from '@jetstream/ui/app-state';
import { useAtom, useAtomValue } from 'jotai';
import { FunctionComponent, useEffect } from 'react';

export const OrgPersistence: FunctionComponent = () => {
  const [selectedOrgId] = useAtom(selectedOrgIdState);
  const orgGroups = useAtomValue(orgGroupsResolvedState);
  const [activeOrgGroupId, setActiveOrgGroup] = useAtom(ActiveOrgGroupState);

  useEffect(() => {
    try {
      if (selectedOrgId) {
        const orgId = btoa(selectedOrgId);
        setItemInSessionStorage(STORAGE_KEYS.SELECTED_ORG_STORAGE_KEY, orgId);
        setItemInLocalStorage(STORAGE_KEYS.SELECTED_ORG_STORAGE_KEY, orgId);
      }
    } catch (ex) {
      logger.error('Error persisting selected org ID', { error: ex, selectedOrgId });
    }
  }, [selectedOrgId]);

  /**
   * Recover from a stale org group selection (e.g. the group was deleted in another browser/session).
   * A persisted group ID that no longer exists filters out every org, leaving the header with no orgs
   * and no group visibly selected. Once groups have actually loaded, reset the selection to the default
   * (no group) which also clears the stored value.
   */
  useEffect(() => {
    // `orgGroups` is undefined until the fetch resolves - skip until then so we don't reset during loading
    if (!orgGroups || !activeOrgGroupId) {
      return;
    }
    const selectedGroupStillExists = orgGroups.some((group) => group.id === activeOrgGroupId);
    if (!selectedGroupStillExists) {
      logger.warn('Resetting invalid selected org group', { activeOrgGroupId });
      setActiveOrgGroup(null);
    }
  }, [orgGroups, activeOrgGroupId, setActiveOrgGroup]);

  return null;
};
