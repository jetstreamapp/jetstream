import { TITLES } from '@jetstream/shared/constants';
import { APP_ROUTES } from '@jetstream/shared/ui-router';
import { useTitle } from '@jetstream/shared/ui-utils';
import { AnalysisToolsPaywall, fromPermissionsState } from '@jetstream/ui-core';
import { analysisToolsAccessState, selectedOrgState, useFeatureFlag } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { useResetAtom } from 'jotai/utils';
import { FunctionComponent, useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';

/**
 * Shell for **Permission analysis**: same org-scoped permission selection state as Manage Permissions,
 * with a separate route tree (`analysis` instead of `editor`).
 */
export const PermissionAnalysis: FunctionComponent = () => {
  useTitle(TITLES.PERMISSION_ANALYSIS);
  const location = useLocation();
  const analysisToolsEnabled = useFeatureFlag('analysis-tools');
  const { hasAnalysisToolsAccess } = useAtomValue(analysisToolsAccessState);
  const selectedOrg = useAtomValue(selectedOrgState);
  const resetProfilesState = useResetAtom(fromPermissionsState.profilesState);
  const resetSelectedProfilesPermSetState = useResetAtom(fromPermissionsState.selectedProfilesPermSetState);
  const resetPermissionSetsState = useResetAtom(fromPermissionsState.permissionSetsState);
  const resetSelectedPermissionSetsState = useResetAtom(fromPermissionsState.selectedPermissionSetsState);
  const resetSObjectsState = useResetAtom(fromPermissionsState.sObjectsState);
  const resetSelectedSObjectsState = useResetAtom(fromPermissionsState.selectedSObjectsState);
  const resetFieldsByObject = useResetAtom(fromPermissionsState.fieldsByObject);
  const resetFieldsByKey = useResetAtom(fromPermissionsState.fieldsByKey);
  const resetObjectPermissionMap = useResetAtom(fromPermissionsState.objectPermissionMap);
  const resetFieldPermissionMap = useResetAtom(fromPermissionsState.fieldPermissionMap);
  const resetTabVisibilityPermissionMap = useResetAtom(fromPermissionsState.tabVisibilityPermissionMap);
  const [priorSelectedOrg, setPriorSelectedOrg] = useState<string | null>(null);

  const selectedProfiles = useAtomValue(fromPermissionsState.selectedProfilesPermSetState);
  const selectedPermissionSets = useAtomValue(fromPermissionsState.selectedPermissionSetsState);
  const hasAnalysisSelections = selectedProfiles.length > 0 || selectedPermissionSets.length > 0;
  const hasJobInUrl = Boolean(new URLSearchParams(location.search).get('job'));

  useEffect(() => {
    if (selectedOrg && !priorSelectedOrg) {
      setPriorSelectedOrg(selectedOrg.uniqueId);
    } else if (selectedOrg && priorSelectedOrg !== selectedOrg.uniqueId) {
      setPriorSelectedOrg(selectedOrg.uniqueId);
      resetProfilesState();
      resetSelectedProfilesPermSetState();
      resetPermissionSetsState();
      resetSelectedPermissionSetsState();
      resetSObjectsState();
      resetSelectedSObjectsState();
      resetFieldsByObject();
      resetFieldsByKey();
      resetObjectPermissionMap();
      resetFieldPermissionMap();
      resetTabVisibilityPermissionMap();
    } else if (!selectedOrg?.uniqueId) {
      resetProfilesState();
      resetSelectedProfilesPermSetState();
      resetPermissionSetsState();
      resetSelectedPermissionSetsState();
      resetSObjectsState();
      resetSelectedSObjectsState();
      resetFieldsByObject();
      resetFieldsByKey();
      resetObjectPermissionMap();
      resetFieldPermissionMap();
      resetTabVisibilityPermissionMap();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg, priorSelectedOrg]);

  const blockAnalysisWithoutSelections = location.pathname.endsWith('/analysis') && !hasAnalysisSelections && !hasJobInUrl;

  if (!analysisToolsEnabled) {
    return <Navigate to={APP_ROUTES.HOME.ROUTE} replace />;
  }
  if (!hasAnalysisToolsAccess) {
    return <AnalysisToolsPaywall featureLabel="Permission Analysis" />;
  }
  return blockAnalysisWithoutSelections ? <Navigate to="." /> : <Outlet />;
};

export default PermissionAnalysis;
