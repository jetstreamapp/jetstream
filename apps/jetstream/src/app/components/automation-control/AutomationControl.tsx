import { TITLES } from '@jetstream/shared/constants';
import React, { Fragment, FunctionComponent, useEffect } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useTitle } from 'react-use';
import { useRecoilState, useRecoilValue, useResetRecoilState } from 'recoil';
import { selectedOrgState } from '../../app-state';
import * as fromAutomationCtlState from './automation-control.state';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ManagePermissionsProps {}

export const ManagePermissions: FunctionComponent<ManagePermissionsProps> = () => {
  useTitle(TITLES.AUTOMATION_CONTROL);
  const navigate = useNavigate();
  const location = useLocation();
  const selectedOrg = useRecoilValue(selectedOrgState);
  const [priorSelectedOrg, setPriorSelectedOrg] = useRecoilState(fromAutomationCtlState.priorSelectedOrg);
  const resetSObjectsState = useResetRecoilState(fromAutomationCtlState.sObjectsState);
  const resetSelectedSObjectsState = useResetRecoilState(fromAutomationCtlState.selectedSObjectsState);
  const resetAutomationTypes = useResetRecoilState(fromAutomationCtlState.automationTypes);
  const resetSelectedAutomationTypes = useResetRecoilState(fromAutomationCtlState.selectedAutomationTypes);

  const hasSelectionsMade = useRecoilValue(fromAutomationCtlState.hasSelectionsMade);

  // reset everything if the selected org changes
  useEffect(() => {
    if (selectedOrg && !priorSelectedOrg) {
      setPriorSelectedOrg(selectedOrg.uniqueId);
    } else if (selectedOrg && priorSelectedOrg !== selectedOrg.uniqueId) {
      setPriorSelectedOrg(selectedOrg.uniqueId);
      resetSObjectsState();
      resetSelectedSObjectsState();
      resetAutomationTypes();
      resetSelectedAutomationTypes();
      if (location.pathname.endsWith('/editor')) {
        navigate('..');
      }
    } else if (!selectedOrg) {
      resetSObjectsState();
      resetSelectedSObjectsState();
      resetAutomationTypes();
      resetSelectedAutomationTypes();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg, priorSelectedOrg]);

  return (
    // eslint-disable-next-line react/jsx-no-useless-fragment
    <Fragment>{location.pathname.endsWith('/editor') && !hasSelectionsMade ? <Navigate to="." /> : <Outlet />}</Fragment>
  );
};

export default ManagePermissions;
