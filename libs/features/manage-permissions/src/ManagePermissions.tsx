import { TITLES } from '@jetstream/shared/constants';
import { useTitle } from '@jetstream/shared/ui-utils';
import { fromPermissionsState } from '@jetstream/ui-core';
import { selectedOrgState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { useResetAtom } from 'jotai/utils';
import { FunctionComponent, useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ManagePermissionsProps {}

export const ManagePermissions: FunctionComponent<ManagePermissionsProps> = () => {
  useTitle(TITLES.MANAGE_PERMISSIONS);
  const location = useLocation();
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

  const hasSelectionsMade = useAtomValue(fromPermissionsState.hasSelectionsMade);

  // reset everything if the selected org changes
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
    } else if (!selectedOrg) {
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

  return location.pathname.endsWith('/editor') && !hasSelectionsMade ? <Navigate to="." /> : <Outlet />;
};

export default ManagePermissions;
