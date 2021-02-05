import { SalesforceOrgUi } from '@jetstream/types';
import React, { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { Redirect, Route, Switch, useRouteMatch } from 'react-router-dom';
import { useRecoilValue, useResetRecoilState } from 'recoil';
import { selectedOrgState } from '../../app-state';
import StateDebugObserver from '../core/StateDebugObserver';
import * as fromPermissionsStateState from './manage-permissions.state';
import ManagePermissionsEditor from './ManagePermissionsEditor';
import ManagePermissionsSelection from './ManagePermissionsSelection';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ManagePermissionsProps {}

export const ManagePermissions: FunctionComponent<ManagePermissionsProps> = () => {
  const match = useRouteMatch();
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  const resetProfilesState = useResetRecoilState(fromPermissionsStateState.profilesState);
  const resetSelectedProfilesPermSetState = useResetRecoilState(fromPermissionsStateState.selectedProfilesPermSetState);
  const resetPermissionSetsState = useResetRecoilState(fromPermissionsStateState.permissionSetsState);
  const resetSelectedPermissionSetsState = useResetRecoilState(fromPermissionsStateState.selectedPermissionSetsState);
  const resetSObjectsState = useResetRecoilState(fromPermissionsStateState.sObjectsState);
  const resetSelectedSObjectsState = useResetRecoilState(fromPermissionsStateState.selectedSObjectsState);
  const resetFieldsByObject = useResetRecoilState(fromPermissionsStateState.fieldsByObject);
  const resetFieldsByKey = useResetRecoilState(fromPermissionsStateState.fieldsByKey);
  const resetObjectPermissionMap = useResetRecoilState(fromPermissionsStateState.objectPermissionMap);
  const resetFieldPermissionMap = useResetRecoilState(fromPermissionsStateState.fieldPermissionMap);
  const [priorSelectedOrg, setPriorSelectedOrg] = useState<string>(null);

  const hasSelectionsMade = useRecoilValue(fromPermissionsStateState.hasSelectionsMade);

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
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg, priorSelectedOrg]);

  return (
    <Fragment>
      <StateDebugObserver
        name="PERMISSION SNAPSHOT"
        atoms={[
          ['sObjectsState', fromPermissionsStateState.sObjectsState],
          ['selectedSObjectsState', fromPermissionsStateState.selectedSObjectsState],
          ['profilesState', fromPermissionsStateState.profilesState],
          ['selectedProfilesPermSetState', fromPermissionsStateState.selectedProfilesPermSetState],
          ['permissionSetsState', fromPermissionsStateState.permissionSetsState],
          ['selectedPermissionSetsState', fromPermissionsStateState.selectedPermissionSetsState],
          ['fieldsByObject', fromPermissionsStateState.fieldsByObject],
          ['fieldsByKey', fromPermissionsStateState.fieldsByKey],
          ['objectPermissionMap', fromPermissionsStateState.objectPermissionMap],
          ['fieldPermissionMap', fromPermissionsStateState.fieldPermissionMap],
        ]}
      />
      <Switch>
        <Route path={`${match.url}`} exact>
          <ManagePermissionsSelection />
        </Route>
        <Route path={`${match.url}/editor`}>{hasSelectionsMade ? <ManagePermissionsEditor /> : <Redirect to={match.url} />}</Route>
      </Switch>
    </Fragment>
  );
};

export default ManagePermissions;
