import { logger } from '@jetstream/shared/client-logger';
import { setItemInLocalStorage, setItemInSessionStorage } from '@jetstream/shared/ui-utils';
import { selectedOrgIdState, STORAGE_KEYS } from '@jetstream/ui/app-state';
import { useAtom } from 'jotai';
import { FunctionComponent, useEffect } from 'react';

export const OrgPersistence: FunctionComponent = () => {
  const [selectedOrgId] = useAtom(selectedOrgIdState);

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

  return null;
};

export default OrgPersistence;
