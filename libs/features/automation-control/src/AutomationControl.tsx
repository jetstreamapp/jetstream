import { TITLES } from '@jetstream/shared/constants';
import { useTitle } from '@jetstream/shared/ui-utils';
import { fromAutomationControlState } from '@jetstream/ui-core';
import { selectedOrgState } from '@jetstream/ui/app-state';
import { useAtom, useAtomValue } from 'jotai';
import { useResetAtom } from 'jotai/utils';
import { Fragment, useEffect } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';

export const AutomationControl = () => {
  useTitle(TITLES.AUTOMATION_CONTROL);
  const navigate = useNavigate();
  const location = useLocation();
  const selectedOrg = useAtomValue(selectedOrgState);
  const [priorSelectedOrg, setPriorSelectedOrg] = useAtom(fromAutomationControlState.priorSelectedOrg);
  const resetSObjectsState = useResetAtom(fromAutomationControlState.sObjectsState);
  const resetSelectedSObjectsState = useResetAtom(fromAutomationControlState.selectedSObjectsState);
  const resetAutomationTypes = useResetAtom(fromAutomationControlState.automationTypes);
  const resetSelectedAutomationTypes = useResetAtom(fromAutomationControlState.selectedAutomationTypes);

  const hasSelectionsMade = useAtomValue(fromAutomationControlState.hasSelectionsMade);

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
