import { TITLES } from '@jetstream/shared/constants';
import { useTitle } from '@jetstream/shared/ui-utils';
import { fromAutomationControlState, selectedOrgState } from '@jetstream/ui-core';
import { Fragment, FunctionComponent, useEffect } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useRecoilState, useRecoilValue, useResetRecoilState } from 'recoil';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface AutomationControlProps {}

export const AutomationControl: FunctionComponent<AutomationControlProps> = () => {
  useTitle(TITLES.AUTOMATION_CONTROL);
  const navigate = useNavigate();
  const location = useLocation();
  const selectedOrg = useRecoilValue(selectedOrgState);
  const [priorSelectedOrg, setPriorSelectedOrg] = useRecoilState(fromAutomationControlState.priorSelectedOrg);
  const resetSObjectsState = useResetRecoilState(fromAutomationControlState.sObjectsState);
  const resetSelectedSObjectsState = useResetRecoilState(fromAutomationControlState.selectedSObjectsState);
  const resetAutomationTypes = useResetRecoilState(fromAutomationControlState.automationTypes);
  const resetSelectedAutomationTypes = useResetRecoilState(fromAutomationControlState.selectedAutomationTypes);

  const hasSelectionsMade = useRecoilValue(fromAutomationControlState.hasSelectionsMade);

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

export default AutomationControl;
