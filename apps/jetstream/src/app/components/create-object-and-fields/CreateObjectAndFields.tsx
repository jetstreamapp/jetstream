import { TITLES } from '@jetstream/shared/constants';
import { SalesforceOrgUi } from '@jetstream/types';
import React, { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { Redirect, Route, Switch, useRouteMatch } from 'react-router-dom';
import { useTitle } from 'react-use';
import { useRecoilState, useRecoilValue, useResetRecoilState } from 'recoil';
import { applicationCookieState, selectedOrgState } from '../../app-state';
import StateDebugObserver from '../core/StateDebugObserver';
import * as fromCreateFieldsState from './create-fields.state';
import CreateFields from './CreateFields';
import CreateFieldsSelection from './CreateFieldsSelection';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface CreateObjectAndFieldsProps {}

export const CreateObjectAndFields: FunctionComponent<CreateObjectAndFieldsProps> = () => {
  useTitle(TITLES.CREATE_OBJ_FIELD);
  const match = useRouteMatch();
  const [{ defaultApiVersion }] = useRecoilState(applicationCookieState);
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  const resetProfilesState = useResetRecoilState(fromCreateFieldsState.profilesState);
  const resetSelectedProfilesPermSetState = useResetRecoilState(fromCreateFieldsState.selectedProfilesPermSetState);
  const resetPermissionSetsState = useResetRecoilState(fromCreateFieldsState.permissionSetsState);
  const resetSelectedPermissionSetsState = useResetRecoilState(fromCreateFieldsState.selectedPermissionSetsState);
  const resetSObjectsState = useResetRecoilState(fromCreateFieldsState.sObjectsState);
  const resetSelectedSObjectsState = useResetRecoilState(fromCreateFieldsState.selectedSObjectsState);
  const resetFieldRowsState = useResetRecoilState(fromCreateFieldsState.fieldRowsState);
  const [priorSelectedOrg, setPriorSelectedOrg] = useState<string>(null);

  const hasSelectionsMade = useRecoilValue(fromCreateFieldsState.hasSelectionsMade);

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

  return (
    <Fragment>
      <StateDebugObserver
        name="CREATE FIELDS SNAPSHOT"
        atoms={[
          ['sObjectsState', fromCreateFieldsState.sObjectsState],
          ['selectedSObjectsState', fromCreateFieldsState.selectedSObjectsState],
          ['profilesState', fromCreateFieldsState.profilesState],
          ['selectedProfilesPermSetState', fromCreateFieldsState.selectedProfilesPermSetState],
          ['permissionSetsState', fromCreateFieldsState.permissionSetsState],
          ['selectedPermissionSetsState', fromCreateFieldsState.selectedPermissionSetsState],
          ['fieldRowsState', fromCreateFieldsState.fieldRowsState],
        ]}
      />
      <Switch>
        <Route path={`${match.url}`} exact>
          <CreateFieldsSelection />
        </Route>
        <Route path={`${match.url}/configurator`}>
          {hasSelectionsMade ? <CreateFields apiVersion={defaultApiVersion} /> : <Redirect to={match.url} />}
        </Route>
      </Switch>
    </Fragment>
  );
};

export default CreateObjectAndFields;
