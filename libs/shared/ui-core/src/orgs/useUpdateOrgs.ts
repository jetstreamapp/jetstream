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
import orderBy from 'lodash/orderBy';
import uniqBy from 'lodash/uniqBy';
import { useCallback, useEffect, useState } from 'react';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import { Observable } from 'rxjs';
import { fromAppState, fromJetstreamEvents, queryHistoryDb, queryHistoryObjectDb } from '..';

export function useUpdateOrgs() {
  const [orgs, setOrgs] = useRecoilState(fromAppState.salesforceOrgsState);
  const setSelectedOrgId = useSetRecoilState(fromAppState.selectedOrgIdState);
  const actionInProgress = useRecoilValue(fromAppState.actionInProgressState);
  const setJetstreamOrganizations = useSetRecoilState(fromAppState.jetstreamOrganizationsState);
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
      setOrgs(await getOrgs());
    } catch (ex) {
      logger.warn('Error refreshing orgs', ex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleRefetchOrganizations = useCallback(async () => {
    try {
      setJetstreamOrganizations(await getJetstreamOrganizations());
    } catch (ex) {
      logger.warn('Error refreshing orgs', ex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * This is not in a useCallback because it caused an infinite loop since orgs changes a lot and is a dependency
   */
  const handleAddOrg = useCallback((org: SalesforceOrgUi, switchActiveOrg: boolean) => {
    setOrgs((prevOrgs) => uniqBy(orderBy([org, ...prevOrgs], 'username'), 'uniqueId'));
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
      queryHistoryDb.deleteAllQueryHistoryForOrg(org);
      queryHistoryObjectDb.deleteAllQueryHistoryObjectForOrg(org);
      // async, but results are ignored as this will not throw
      clearCacheForOrg(org);
      clearQueryHistoryForOrg(org);
    } catch (ex) {
      logger.warn('Error removing org', ex);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUpdateOrg = useCallback(async (org: SalesforceOrgUi, updatedOrg: Partial<SalesforceOrgUi>) => {
    try {
      setOrgLoading(true);
      await updateOrg(org, updatedOrg);
      setOrgs(await getOrgs());
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
