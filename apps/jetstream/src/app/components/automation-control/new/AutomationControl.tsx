import { TITLES } from '@jetstream/shared/constants';
import React, { FunctionComponent, useEffect } from 'react';
import { Redirect, Route, Switch, useHistory, useRouteMatch } from 'react-router-dom';
import { useTitle } from 'react-use';
import { useRecoilState, useRecoilValue, useResetRecoilState } from 'recoil';
import { selectedOrgState } from '../../../app-state';
import * as fromAutomationCtlState from './automation-control.state';
import AutomationControlEditor from './AutomationControlEditor';
import AutomationControlSelection from './AutomationControlSelection';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ManagePermissionsProps {}

export const ManagePermissions: FunctionComponent<ManagePermissionsProps> = () => {
  useTitle(TITLES.MANAGE_PERMISSIONS);
  const match = useRouteMatch();
  const history = useHistory();
  const goBackUrl = match.url.replace('/editor', '');
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
      if (match.url.endsWith('/editor')) {
        history.push(goBackUrl);
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
    <Switch>
      <Route path={`${match.url}`} exact>
        <AutomationControlSelection />
      </Route>
      <Route path={`${match.url}/editor`}>
        {hasSelectionsMade ? <AutomationControlEditor goBackUrl={goBackUrl} /> : <Redirect to={match.url} />}
      </Route>
    </Switch>
  );
};

export default ManagePermissions;
