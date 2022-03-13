import { TITLES } from '@jetstream/shared/constants';
import { SalesforceOrgUi } from '@jetstream/types';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { Redirect, Route, Switch, useRouteMatch } from 'react-router-dom';
import { useTitle } from 'react-use';
import { useRecoilValue, useResetRecoilState } from 'recoil';
import { selectedOrgState } from '../../app-state';
import StateDebugObserver from '../core/StateDebugObserver';
import MassUpdateRecordsDeployment from './deployment/MassUpdateRecordsDeployment';
import * as fromMassUpdateState from './mass-update-records.state';
import MassUpdateRecordsSelection from './selection/MassUpdateRecordsSelection';

export const MassUpdateRecords: FunctionComponent = () => {
  useTitle(TITLES.MASS_UPDATE_RECORDS);
  const match = useRouteMatch();
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  const resetRowMapState = useResetRecoilState(fromMassUpdateState.rowsMapState);
  const resetSObjectsState = useResetRecoilState(fromMassUpdateState.sObjectsState);
  const resetSelectedSObjectsState = useResetRecoilState(fromMassUpdateState.selectedSObjectsState);

  const isConfigured = useRecoilValue(fromMassUpdateState.isConfigured);

  const [priorSelectedOrg, setPriorSelectedOrg] = useState<string>(null);

  useEffect(() => {
    return () => {
      setPriorSelectedOrg(selectedOrg.uniqueId);
      resetRowMapState();
      resetSObjectsState();
      resetSelectedSObjectsState();
      resetSObjectsState();
      resetSelectedSObjectsState();
    };
  }, []);

  // reset everything if the selected org changes
  useEffect(() => {
    if (selectedOrg && !priorSelectedOrg) {
      setPriorSelectedOrg(selectedOrg.uniqueId);
    } else if (selectedOrg && priorSelectedOrg !== selectedOrg.uniqueId) {
      setPriorSelectedOrg(selectedOrg.uniqueId);
      resetRowMapState();
      resetSObjectsState();
      resetSelectedSObjectsState();
      resetSObjectsState();
      resetSelectedSObjectsState();
    } else if (!selectedOrg) {
      resetRowMapState();
      resetSObjectsState();
      resetSelectedSObjectsState();
      resetSObjectsState();
      resetSelectedSObjectsState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg, priorSelectedOrg]);

  return (
    <Fragment>
      <StateDebugObserver
        name="CREATE FIELDS SNAPSHOT"
        atoms={[
          ['sObjectsState', fromMassUpdateState.sObjectsState],
          ['selectedSObjectsState', fromMassUpdateState.selectedSObjectsState],
          ['rowsState', fromMassUpdateState.rowsState],
          ['rowsMapState', fromMassUpdateState.rowsMapState],
          ['sObjectsState', fromMassUpdateState.sObjectsState],
          ['selectedSObjectsState', fromMassUpdateState.selectedSObjectsState],
          ['isConfigured', fromMassUpdateState.isConfigured],
        ]}
      />
      <Switch>
        <Route path={`${match.url}`} exact>
          <MassUpdateRecordsSelection selectedOrg={selectedOrg} />
        </Route>
        <Route path={`${match.url}/deployment`}>
          {isConfigured ? <MassUpdateRecordsDeployment selectedOrg={selectedOrg} /> : <Redirect to={match.url} />}
        </Route>
      </Switch>
    </Fragment>
  );
};

export default MassUpdateRecords;
