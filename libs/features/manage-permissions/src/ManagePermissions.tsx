import { TITLES } from '@jetstream/shared/constants';
import { useTitle } from '@jetstream/shared/ui-utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { StateDebugObserver, fromPermissionsState, selectedOrgState } from '@jetstream/ui-core';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useRecoilValue, useResetRecoilState } from 'recoil';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ManagePermissionsProps {}

export const ManagePermissions: FunctionComponent<ManagePermissionsProps> = () => {
  useTitle(TITLES.MANAGE_PERMISSIONS);
  const location = useLocation();
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  const resetProfilesState = useResetRecoilState(fromPermissionsState.profilesState);
  const resetSelectedProfilesPermSetState = useResetRecoilState(fromPermissionsState.selectedProfilesPermSetState);
  const resetPermissionSetsState = useResetRecoilState(fromPermissionsState.permissionSetsState);
  const resetSelectedPermissionSetsState = useResetRecoilState(fromPermissionsState.selectedPermissionSetsState);
  const resetSObjectsState = useResetRecoilState(fromPermissionsState.sObjectsState);
  const resetSelectedSObjectsState = useResetRecoilState(fromPermissionsState.selectedSObjectsState);
  const resetFieldsByObject = useResetRecoilState(fromPermissionsState.fieldsByObject);
  const resetFieldsByKey = useResetRecoilState(fromPermissionsState.fieldsByKey);
  const resetObjectPermissionMap = useResetRecoilState(fromPermissionsState.objectPermissionMap);
  const resetFieldPermissionMap = useResetRecoilState(fromPermissionsState.fieldPermissionMap);
  const resetTabVisibilityPermissionMap = useResetRecoilState(fromPermissionsState.tabVisibilityPermissionMap);
  const [priorSelectedOrg, setPriorSelectedOrg] = useState<string | null>(null);

  const hasSelectionsMade = useRecoilValue(fromPermissionsState.hasSelectionsMade);

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

  return (
    <Fragment>
      <StateDebugObserver
        name="PERMISSION SNAPSHOT"
        atoms={[
          ['sObjectsState', fromPermissionsState.sObjectsState],
          ['selectedSObjectsState', fromPermissionsState.selectedSObjectsState],
          ['profilesState', fromPermissionsState.profilesState],
          ['selectedProfilesPermSetState', fromPermissionsState.selectedProfilesPermSetState],
          ['permissionSetsState', fromPermissionsState.permissionSetsState],
          ['selectedPermissionSetsState', fromPermissionsState.selectedPermissionSetsState],
          ['fieldsByObject', fromPermissionsState.fieldsByObject],
          ['fieldsByKey', fromPermissionsState.fieldsByKey],
          ['objectPermissionMap', fromPermissionsState.objectPermissionMap],
          ['fieldPermissionMap', fromPermissionsState.fieldPermissionMap],
          ['tabVisibilityPermissionMap', fromPermissionsState.tabVisibilityPermissionMap],
        ]}
      />
      {location.pathname.endsWith('/editor') && !hasSelectionsMade ? <Navigate to="." /> : <Outlet />}
    </Fragment>
  );
};

export default ManagePermissions;
