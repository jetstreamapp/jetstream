import { TITLES } from '@jetstream/shared/constants';
import { useTitle } from '@jetstream/shared/ui-utils';
import { fromDeployMetadataState } from '@jetstream/ui-core';
import { selectedOrgState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { useResetAtom } from 'jotai/utils';
import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';

export const DeployMetadata = () => {
  useTitle(TITLES.DEPLOY_METADATA);
  const location = useLocation();
  const selectedOrg = useAtomValue(selectedOrgState);
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

  return location.pathname.endsWith('/deploy') && !hasSelectionsMade ? <Navigate to="." /> : <Outlet />;
};

export default DeployMetadata;
