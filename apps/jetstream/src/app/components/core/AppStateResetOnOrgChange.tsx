import { SalesforceOrgUi } from '@jetstream/types';
import {
  fromAppState,
  fromAutomationControlState,
  fromDeployMetadataState,
  fromFormulaState,
  fromLoadRecordsState,
  fromPermissionsState,
  fromQueryState,
} from '@jetstream/ui-core';
import { FunctionComponent, useEffect, useState } from 'react';
import { Resetter, useRecoilValue, useResetRecoilState } from 'recoil';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface AppStateResetOnOrgChangeProps {}

export const AppStateResetOnOrgChange: FunctionComponent<AppStateResetOnOrgChangeProps> = () => {
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(fromAppState.selectedOrgState);
  const [priorSelectedOrg, setPriorSelectedOrg] = useState<string | null>(null);

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
    useResetRecoilState(fromLoadRecordsState.sObjectsState),
    useResetRecoilState(fromLoadRecordsState.selectedSObjectState),
    useResetRecoilState(fromLoadRecordsState.fieldMappingState),
    // AUTOMATION-CONTROL
    useResetRecoilState(fromAutomationControlState.sObjectsState),
    // Manage Permissions
    useResetRecoilState(fromPermissionsState.profilesState),
    useResetRecoilState(fromPermissionsState.selectedProfilesPermSetState),
    useResetRecoilState(fromPermissionsState.permissionSetsState),
    useResetRecoilState(fromPermissionsState.selectedPermissionSetsState),
    useResetRecoilState(fromPermissionsState.sObjectsState),
    useResetRecoilState(fromPermissionsState.selectedSObjectsState),
    useResetRecoilState(fromPermissionsState.fieldsByObject),
    useResetRecoilState(fromPermissionsState.fieldsByKey),
    useResetRecoilState(fromPermissionsState.objectPermissionMap),
    useResetRecoilState(fromPermissionsState.fieldPermissionMap),
    useResetRecoilState(fromPermissionsState.tabVisibilityPermissionMap),
    // Deploy
    useResetRecoilState(fromDeployMetadataState.metadataItemsState),
    useResetRecoilState(fromDeployMetadataState.metadataItemsMapState),
    useResetRecoilState(fromDeployMetadataState.selectedMetadataItemsState),
    useResetRecoilState(fromDeployMetadataState.usersList),
    useResetRecoilState(fromDeployMetadataState.metadataSelectionTypeState),
    useResetRecoilState(fromDeployMetadataState.changesetPackage),
    useResetRecoilState(fromDeployMetadataState.changesetPackages),
    // Formula
    useResetRecoilState(fromFormulaState.sourceTypeState),
    useResetRecoilState(fromFormulaState.selectedSObjectState),
    useResetRecoilState(fromFormulaState.selectedFieldState),
    useResetRecoilState(fromFormulaState.recordIdState),
    useResetRecoilState(fromFormulaState.formulaValueState),
    useResetRecoilState(fromFormulaState.numberNullBehaviorState),
    useResetRecoilState(fromFormulaState.bannerDismissedState),
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

  return null;
};

export default AppStateResetOnOrgChange;
