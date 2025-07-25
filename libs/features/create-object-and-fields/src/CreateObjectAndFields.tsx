import { TITLES } from '@jetstream/shared/constants';
import { useTitle } from '@jetstream/shared/ui-utils';
import { selectedOrgState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { useResetAtom } from 'jotai/utils';
import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import * as fromCreateFieldsState from './create-fields.state';

export const CreateObjectAndFields = () => {
  useTitle(TITLES.CREATE_OBJ_FIELD);
  const location = useLocation();
  const selectedOrg = useAtomValue(selectedOrgState);
  const resetProfilesState = useResetAtom(fromCreateFieldsState.profilesState);
  const resetSelectedProfilesPermSetState = useResetAtom(fromCreateFieldsState.selectedProfilesPermSetState);
  const resetPermissionSetsState = useResetAtom(fromCreateFieldsState.permissionSetsState);
  const resetSelectedPermissionSetsState = useResetAtom(fromCreateFieldsState.selectedPermissionSetsState);
  const resetSObjectsState = useResetAtom(fromCreateFieldsState.sObjectsState);
  const resetSelectedSObjectsState = useResetAtom(fromCreateFieldsState.selectedSObjectsState);
  const resetFieldRowsState = useResetAtom(fromCreateFieldsState.fieldRowsState);
  const [priorSelectedOrg, setPriorSelectedOrg] = useState<string | null>(null);

  const hasSelectionsMade = useAtomValue(fromCreateFieldsState.hasSelectionsMade);

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
      resetFieldRowsState();
    } else if (!selectedOrg) {
      resetProfilesState();
      resetSelectedProfilesPermSetState();
      resetPermissionSetsState();
      resetSelectedPermissionSetsState();
      resetSObjectsState();
      resetSelectedSObjectsState();
      resetFieldRowsState();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg, priorSelectedOrg]);

  return location.pathname.endsWith('/configurator') && !hasSelectionsMade ? <Navigate to="." /> : <Outlet />;
};

export default CreateObjectAndFields;
