import { SalesforceOrgUi } from '@jetstream/types';
import React, { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { Resetter, useRecoilValue, useResetRecoilState } from 'recoil';
import * as fromAppState from '../../app-state';
import * as fromAutomationControlState from '../automation-control/automation-control.state';
import * as fromLoadState from '../load-records/load-records.state';
import * as fromQueryState from '../query/query.state';
import * as fromPermissionsStateState from '../manage-permissions/manage-permissions.state';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface AppStateResetOnOrgChangeProps {}

export const AppStateResetOnOrgChange: FunctionComponent<AppStateResetOnOrgChangeProps> = () => {
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(fromAppState.selectedOrgState);
  const [priorSelectedOrg, setPriorSelectedOrg] = useState<string>(null);

  const resetFns: Resetter[] = [
    // QUERY
    useResetRecoilState(fromQueryState.sObjectsState),
    useResetRecoilState(fromQueryState.selectedSObjectState),
    useResetRecoilState(fromQueryState.queryFieldsKey),
    useResetRecoilState(fromQueryState.queryChildRelationships),
    useResetRecoilState(fromQueryState.queryFieldsMapState),
    useResetRecoilState(fromQueryState.selectedQueryFieldsState),
    useResetRecoilState(fromQueryState.selectedSubqueryFieldsState),
    useResetRecoilState(fromQueryState.filterQueryFieldsState),
    useResetRecoilState(fromQueryState.orderByQueryFieldsState),
    useResetRecoilState(fromQueryState.queryFiltersState),
    useResetRecoilState(fromQueryState.queryLimit),
    useResetRecoilState(fromQueryState.queryLimitSkip),
    useResetRecoilState(fromQueryState.queryOrderByState),
    useResetRecoilState(fromQueryState.querySoqlState),
    // LOAD
    useResetRecoilState(fromLoadState.sObjectsState),
    useResetRecoilState(fromLoadState.selectedSObjectState),
    useResetRecoilState(fromLoadState.fieldMappingState),
    // AUTOMATION-CONTROL
    useResetRecoilState(fromAutomationControlState.sObjectsState),
    useResetRecoilState(fromAutomationControlState.itemIds),
    useResetRecoilState(fromAutomationControlState.itemsById),
    useResetRecoilState(fromAutomationControlState.activeItemId),
    useResetRecoilState(fromAutomationControlState.tabs),
    // Manage Permissions
    useResetRecoilState(fromPermissionsStateState.profilesState),
    useResetRecoilState(fromPermissionsStateState.selectedProfilesPermSetState),
    useResetRecoilState(fromPermissionsStateState.permissionSetsState),
    useResetRecoilState(fromPermissionsStateState.selectedPermissionSetsState),
    useResetRecoilState(fromPermissionsStateState.sObjectsState),
    useResetRecoilState(fromPermissionsStateState.selectedSObjectsState),
    useResetRecoilState(fromPermissionsStateState.fieldsByObject),
    useResetRecoilState(fromPermissionsStateState.fieldsByKey),
    useResetRecoilState(fromPermissionsStateState.objectPermissionMap),
    useResetRecoilState(fromPermissionsStateState.fieldPermissionMap),
  ];

  useEffect(() => {
    if (selectedOrg && !priorSelectedOrg) {
      setPriorSelectedOrg(selectedOrg.uniqueId);
    } else if (selectedOrg && priorSelectedOrg !== selectedOrg.uniqueId) {
      setPriorSelectedOrg(selectedOrg.uniqueId);
      resetFns.forEach((resetFn) => resetFn());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg, priorSelectedOrg]);

  return <Fragment />;
};

export default AppStateResetOnOrgChange;
