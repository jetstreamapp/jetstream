import { logger } from '@jetstream/shared/client-logger';
import {
  clearCacheForOrg,
  clearQueryHistoryForOrg,
  deleteOrg,
  getJetstreamOrganizations,
  getOrgs,
  updateOrg,
} from '@jetstream/shared/data';
import { useObservable } from '@jetstream/shared/ui-utils';
import { JetstreamEventAddOrgPayload, SalesforceOrgUi } from '@jetstream/types';
import { fromAppState } from '@jetstream/ui/app-state';
import { apiRequestHistoryDb, queryHistoryDb, queryHistoryObjectDb, recentHistoryItemsDb } from '@jetstream/ui/db';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import orderBy from 'lodash/orderBy';
import uniqBy from 'lodash/uniqBy';
import { useCallback, useEffect, useState } from 'react';
import { Observable } from 'rxjs';
import { fromJetstreamEvents } from '..';

async function deleteAllHistoryRecords(org: SalesforceOrgUi) {
  try {
    await queryHistoryDb.deleteAllQueryHistoryForOrgExceptFavorites(org);
  } catch (ex) {
    logger.warn('Error running deleteAllQueryHistoryForOrgExceptFavorites history for org', ex);
  }
  try {
    await queryHistoryObjectDb.deleteAllQueryHistoryObjectForOrg(org);
  } catch (ex) {
    logger.warn('Error running deleteAllQueryHistoryObjectForOrg for org', ex);
  }
  try {
    await recentHistoryItemsDb.clearRecentHistoryItemsForCurrentOrg(org.uniqueId);
  } catch (ex) {
    logger.warn('Error running clearRecentHistoryItemsForCurrentOrg for org', ex);
  }
  try {
    await apiRequestHistoryDb.deleteAllApiHistoryForOrg(org);
  } catch (ex) {
    logger.warn('Error running deleteAllApiHistoryForOrg for org', ex);
  }
  try {
    await clearCacheForOrg(org);
  } catch (ex) {
    logger.warn('Error running clearCacheForOrg for org', ex);
  }
  try {
    await clearQueryHistoryForOrg(org);
  } catch (ex) {
    logger.warn('Error running clearQueryHistoryForOrg for org', ex);
  }
}

export function useUpdateOrgs() {
  const [orgs, setOrgs] = useAtom(fromAppState.salesforceOrgsState);
  const setSelectedOrgId = useSetAtom(fromAppState.selectedOrgIdState);
  const actionInProgress = useAtomValue(fromAppState.actionInProgressState);
  const setJetstreamOrganizations = useSetAtom(fromAppState.jetstreamOrganizationsState);
  const [orgLoading, setOrgLoading] = useState(false);

  // subscribe to org changes from other places in the application
  const onAddOrgFromExternalSource = useObservable(fromJetstreamEvents.getObservable('addOrg') as Observable<JetstreamEventAddOrgPayload>);

  useEffect(() => {
    if (onAddOrgFromExternalSource && onAddOrgFromExternalSource.org) {
      handleAddOrg(onAddOrgFromExternalSource.org, onAddOrgFromExternalSource.switchActiveOrg);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onAddOrgFromExternalSource]);

  const handleRefetchOrgs = useCallback(async () => {
    try {
      setOrgs(getOrgs());
    } catch (ex) {
      logger.warn('Error refreshing orgs', ex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefetchOrganizations = useCallback(async () => {
    try {
      setJetstreamOrganizations(getJetstreamOrganizations());
    } catch (ex) {
      logger.warn('Error refreshing orgs', ex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * This is not in a useCallback because it caused an infinite loop since orgs changes a lot and is a dependency
   */
  const handleAddOrg = useCallback((org: SalesforceOrgUi, switchActiveOrg: boolean) => {
    setOrgs(async (prevOrgs) => uniqBy(orderBy([org, ...(await prevOrgs)], 'username'), 'uniqueId'));
    if (switchActiveOrg) {
      setSelectedOrgId(org.uniqueId);
    }
    handleRefetchOrgs();
    handleRefetchOrganizations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRemoveOrg = useCallback(async (org: SalesforceOrgUi) => {
    try {
      await deleteOrg(org);
      handleRefetchOrgs();
      handleRefetchOrganizations();
      setSelectedOrgId(null);
      deleteAllHistoryRecords(org);
    } catch (ex) {
      logger.warn('Error removing org', ex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpdateOrg = useCallback(async (org: SalesforceOrgUi, updatedOrg: Partial<SalesforceOrgUi>) => {
    try {
      setOrgLoading(true);
      await updateOrg(org, updatedOrg);
      setOrgs(getOrgs());
    } catch (ex) {
      logger.warn('Error updating org', ex);
    } finally {
      setOrgLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    orgs,
    actionInProgress,
    orgLoading,
    handleAddOrg,
    handleRemoveOrg,
    handleUpdateOrg,
  };
}
