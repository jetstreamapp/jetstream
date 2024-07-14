import { TITLES } from '@jetstream/shared/constants';
import { useTitle } from '@jetstream/shared/ui-utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { StateDebugObserver, fromDeployMetadataState, selectedOrgState } from '@jetstream/ui-core';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useRecoilValue, useResetRecoilState } from 'recoil';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface DeployMetadataProps {}

export const DeployMetadata: FunctionComponent<DeployMetadataProps> = () => {
  useTitle(TITLES.DEPLOY_METADATA);
  const location = useLocation();
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  const hasSelectionsMade = useRecoilValue<boolean>(fromDeployMetadataState.hasSelectionsMadeSelector);
  const resetMetadataItemsState = useResetRecoilState(fromDeployMetadataState.metadataItemsState);
  const resetMetadataItemsMapState = useResetRecoilState(fromDeployMetadataState.metadataItemsMapState);
  const resetSelectedMetadataItemsState = useResetRecoilState(fromDeployMetadataState.selectedMetadataItemsState);
  const resetUsersList = useResetRecoilState(fromDeployMetadataState.usersList);
  const resetMetadataSelectionTypeState = useResetRecoilState(fromDeployMetadataState.metadataSelectionTypeState);
  const resetSelectedUsersState = useResetRecoilState(fromDeployMetadataState.selectedUsersState);
  const resetChangesetPackage = useResetRecoilState(fromDeployMetadataState.changesetPackage);
  const resetChangesetPackages = useResetRecoilState(fromDeployMetadataState.changesetPackages);

  const [priorSelectedOrg, setPriorSelectedOrg] = useState<string | null>(null);

  // reset everything if the selected org changes
  useEffect(() => {
    if (selectedOrg && !priorSelectedOrg) {
      setPriorSelectedOrg(selectedOrg.uniqueId);
    } else if (!selectedOrg || (selectedOrg && priorSelectedOrg !== selectedOrg.uniqueId)) {
      setPriorSelectedOrg(selectedOrg.uniqueId);
      resetMetadataItemsState();
      resetMetadataItemsMapState();
      resetSelectedMetadataItemsState();
      resetUsersList();
      resetMetadataSelectionTypeState();
      resetSelectedUsersState();
      resetChangesetPackage();
      resetChangesetPackages();
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
          ['dateRangeStartState', fromDeployMetadataState.dateRangeStartState],
          ['dateRangeEndState', fromDeployMetadataState.dateRangeEndState],
          ['selectedUsersState', fromDeployMetadataState.selectedUsersState],
          ['hasSelectionsMadeSelector', fromDeployMetadataState.hasSelectionsMadeSelector],
          ['listMetadataQueriesSelector', fromDeployMetadataState.listMetadataQueriesSelector],
        ]}
      />
      {location.pathname.endsWith('/deploy') && !hasSelectionsMade ? <Navigate to="." /> : <Outlet />}
    </Fragment>
  );
};

export default DeployMetadata;
