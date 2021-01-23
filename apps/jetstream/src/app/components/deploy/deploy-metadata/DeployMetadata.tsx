import { SalesforceOrgUi } from '@jetstream/types';
import React, { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { Redirect, Route, Switch, useRouteMatch } from 'react-router-dom';
import { useRecoilValue, useResetRecoilState } from 'recoil';
import { selectedOrgState } from '../../../app-state';
import StateDebugObserver from '../../core/StateDebugObserver';
import * as fromDeployMetadataState from './deploy-metadata.state';
import DeployMetadataDeployment from './DeployMetadataDeployment';
import DeployMetadataSelection from './DeployMetadataSelection';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface DeployMetadataProps {}

export const DeployMetadata: FunctionComponent<DeployMetadataProps> = () => {
  const match = useRouteMatch();
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  const hasSelectionsMade = useRecoilValue<boolean>(fromDeployMetadataState.hasSelectionsMadeSelector);
  const metadataItemsState = useResetRecoilState(fromDeployMetadataState.metadataItemsState);
  const metadataItemsMapState = useResetRecoilState(fromDeployMetadataState.metadataItemsMapState);
  const selectedMetadataItemsState = useResetRecoilState(fromDeployMetadataState.selectedMetadataItemsState);
  const usersList = useResetRecoilState(fromDeployMetadataState.usersList);
  const metadataSelectionTypeState = useResetRecoilState(fromDeployMetadataState.metadataSelectionTypeState);
  const userSelectionState = useResetRecoilState(fromDeployMetadataState.userSelectionState);
  const dateRangeSelectionState = useResetRecoilState(fromDeployMetadataState.dateRangeSelectionState);
  const dateRangeState = useResetRecoilState(fromDeployMetadataState.dateRangeState);
  const selectedUsersState = useResetRecoilState(fromDeployMetadataState.selectedUsersState);

  const [priorSelectedOrg, setPriorSelectedOrg] = useState<string>(null);

  // reset everything if the selected org changes
  useEffect(() => {
    if (selectedOrg && !priorSelectedOrg) {
      setPriorSelectedOrg(selectedOrg.uniqueId);
    } else if (!selectedOrg || (selectedOrg && priorSelectedOrg !== selectedOrg.uniqueId)) {
      setPriorSelectedOrg(selectedOrg.uniqueId);
      metadataItemsState();
      metadataItemsMapState();
      selectedMetadataItemsState();
      usersList();
      metadataSelectionTypeState();
      userSelectionState();
      dateRangeSelectionState();
      dateRangeState();
      selectedUsersState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg, priorSelectedOrg]);

  return (
    <Fragment>
      <StateDebugObserver
        name="DEPLOY METADATA SNAPSHOT"
        atoms={[
          ['metadataItemsState', fromDeployMetadataState.metadataItemsState],
          ['metadataItemsMapState', fromDeployMetadataState.metadataItemsMapState],
          ['selectedMetadataItemsState', fromDeployMetadataState.selectedMetadataItemsState],
          ['usersList', fromDeployMetadataState.usersList],
          ['metadataSelectionTypeState', fromDeployMetadataState.metadataSelectionTypeState],
          ['userSelectionState', fromDeployMetadataState.userSelectionState],
          ['dateRangeSelectionState', fromDeployMetadataState.dateRangeSelectionState],
          ['dateRangeState', fromDeployMetadataState.dateRangeState],
          ['selectedUsersState', fromDeployMetadataState.selectedUsersState],
          ['hasSelectionsMadeSelector', fromDeployMetadataState.hasSelectionsMadeSelector],
          ['listMetadataQueriesSelector', fromDeployMetadataState.listMetadataQueriesSelector],
        ]}
      />
      <Switch>
        <Route path={`${match.url}`} exact>
          <DeployMetadataSelection selectedOrg={selectedOrg} />
        </Route>
        <Route path={`${match.url}/deploy`}>
          {hasSelectionsMade ? <DeployMetadataDeployment selectedOrg={selectedOrg} /> : <Redirect to={match.url} />}
        </Route>
      </Switch>
    </Fragment>
  );
};

export default DeployMetadata;
