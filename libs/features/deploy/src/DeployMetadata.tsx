import { TITLES } from '@jetstream/shared/constants';
import { useTitle } from '@jetstream/shared/ui-utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { StateDebugObserver, fromDeployMetadataState } from '@jetstream/ui-core';
import { selectedOrgState } from '@jetstream/ui/app-state';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useResetAtom } from 'jotai/utils';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface DeployMetadataProps {}

export const DeployMetadata: FunctionComponent<DeployMetadataProps> = () => {
  useTitle(TITLES.DEPLOY_METADATA);
  const location = useLocation();
  const selectedOrg = useAtomValue<SalesforceOrgUi>(selectedOrgState);
  const hasSelectionsMade = useAtomValue<boolean>(fromDeployMetadataState.hasSelectionsMadeSelector);
  const resetMetadataItemsState = useResetAtom(fromDeployMetadataState.metadataItemsState);
  const resetMetadataItemsMapState = useResetAtom(fromDeployMetadataState.metadataItemsMapState);
  const resetSelectedMetadataItemsState = useResetAtom(fromDeployMetadataState.selectedMetadataItemsState);
  const resetUsersList = useResetAtom(fromDeployMetadataState.usersList);
  const resetMetadataSelectionTypeState = useResetAtom(fromDeployMetadataState.metadataSelectionTypeState);
  const resetSelectedUsersState = useResetAtom(fromDeployMetadataState.selectedUsersState);
  const resetChangesetPackage = useResetAtom(fromDeployMetadataState.changesetPackage);
  const resetChangesetPackages = useResetAtom(fromDeployMetadataState.changesetPackages);

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
