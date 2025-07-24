import {
  fromAutomationControlState,
  fromDeployMetadataState,
  fromFormulaState,
  fromLoadRecordsState,
  fromPermissionsState,
  fromQueryState,
} from '@jetstream/ui-core';
import { fromAppState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { useEffect, useState } from 'react';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useResetAtom } from 'jotai/utils';

export const AppStateResetOnOrgChange = () => {
  const selectedOrg = useAtomValue(fromAppState.selectedOrgState);
  const [priorSelectedOrg, setPriorSelectedOrg] = useState<string | null>(null);

  const resetFns = [
    // QUERY
    useResetAtom(fromQueryState.sObjectsState),
    useResetAtom(fromQueryState.selectedSObjectState),
    useResetAtom(fromQueryState.queryFieldsKey),
    useResetAtom(fromQueryState.queryChildRelationships),
    useResetAtom(fromQueryState.queryFieldsMapState),
    useResetAtom(fromQueryState.selectedQueryFieldsState),
    useResetAtom(fromQueryState.selectedSubqueryFieldsState),
    useResetAtom(fromQueryState.filterQueryFieldsState),
    useResetAtom(fromQueryState.orderByQueryFieldsState),
    useResetAtom(fromQueryState.queryFiltersState),
    useResetAtom(fromQueryState.queryLimit),
    useResetAtom(fromQueryState.queryLimitSkip),
    useResetAtom(fromQueryState.queryOrderByState),
    useResetAtom(fromQueryState.querySoqlState),
    // LOAD
    useResetAtom(fromLoadRecordsState.sObjectsState),
    useResetAtom(fromLoadRecordsState.selectedSObjectState),
    useResetAtom(fromLoadRecordsState.fieldMappingState),
    // AUTOMATION-CONTROL
    useResetAtom(fromAutomationControlState.sObjectsState),
    // Manage Permissions
    useResetAtom(fromPermissionsState.profilesState),
    useResetAtom(fromPermissionsState.selectedProfilesPermSetState),
    useResetAtom(fromPermissionsState.permissionSetsState),
    useResetAtom(fromPermissionsState.selectedPermissionSetsState),
    useResetAtom(fromPermissionsState.sObjectsState),
    useResetAtom(fromPermissionsState.selectedSObjectsState),
    useResetAtom(fromPermissionsState.fieldsByObject),
    useResetAtom(fromPermissionsState.fieldsByKey),
    useResetAtom(fromPermissionsState.objectPermissionMap),
    useResetAtom(fromPermissionsState.fieldPermissionMap),
    useResetAtom(fromPermissionsState.tabVisibilityPermissionMap),
    // Deploy
    useResetAtom(fromDeployMetadataState.metadataItemsState),
    useResetAtom(fromDeployMetadataState.metadataItemsMapState),
    useResetAtom(fromDeployMetadataState.selectedMetadataItemsState),
    useResetAtom(fromDeployMetadataState.usersList),
    useResetAtom(fromDeployMetadataState.metadataSelectionTypeState),
    useResetAtom(fromDeployMetadataState.changesetPackage),
    useResetAtom(fromDeployMetadataState.changesetPackages),
    // Formula
    useResetAtom(fromFormulaState.sourceTypeState),
    useResetAtom(fromFormulaState.selectedSObjectState),
    useResetAtom(fromFormulaState.selectedFieldState),
    useResetAtom(fromFormulaState.recordIdState),
    useResetAtom(fromFormulaState.formulaValueState),
    useResetAtom(fromFormulaState.numberNullBehaviorState),
    useResetAtom(fromFormulaState.bannerDismissedState),
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
