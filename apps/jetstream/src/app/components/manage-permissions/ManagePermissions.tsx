import { SalesforceOrgUi } from '@jetstream/types';
import React, { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { Redirect, Route, Switch, useLocation, useRouteMatch } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { selectedOrgState } from '../../app-state';
import StateDebugObserver from '../core/StateDebugObserver';
import ManagePermissionsSelection from './ManagePermissionsSelection';
import * as fromPermissionsStateState from './manage-permissions.state';
import ManagePermissionsEditor from './ManagePermissionsEditor';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface QueryProps {}

export const Query: FunctionComponent<QueryProps> = () => {
  const match = useRouteMatch();
  const location = useLocation<{ soql: string }>();
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  // const resetSobjects = useResetRecoilState(fromQueryState.sObjectsState);
  // const resetSelectedSObject = useResetRecoilState(fromQueryState.selectedSObjectState);
  // const resetQueryFieldsKey = useResetRecoilState(fromQueryState.queryFieldsKey);
  // const resetQueryFieldsMapState = useResetRecoilState(fromQueryState.queryFieldsMapState);
  // const resetSelectedQueryFieldsState = useResetRecoilState(fromQueryState.selectedQueryFieldsState);
  // const resetSelectedSubqueryFieldsState = useResetRecoilState(fromQueryState.selectedSubqueryFieldsState);
  // const resetQueryFiltersState = useResetRecoilState(fromQueryState.queryFiltersState);
  // const resetQueryLimitSkip = useResetRecoilState(fromQueryState.queryLimitSkip);
  // const resetQueryOrderByState = useResetRecoilState(fromQueryState.queryOrderByState);
  // const resetQuerySoqlState = useResetRecoilState(fromQueryState.querySoqlState);
  const [priorSelectedOrg, setPriorSelectedOrg] = useState<string>(null);

  const hasSelectionsMade = useRecoilValue(fromPermissionsStateState.hasSelectionsMade);

  // reset everything if the selected org changes
  useEffect(() => {
    if (selectedOrg && !priorSelectedOrg) {
      setPriorSelectedOrg(selectedOrg.uniqueId);
    } else if (selectedOrg && priorSelectedOrg !== selectedOrg.uniqueId) {
      setPriorSelectedOrg(selectedOrg.uniqueId);
      // resetSobjects();
      // resetSelectedSObject();
      // resetQueryFieldsKey();
      // resetQueryFieldsMapState();
      // resetSelectedQueryFieldsState();
      // resetSelectedSubqueryFieldsState();
      // resetQueryFiltersState();
      // resetQueryLimitSkip();
      // resetQueryOrderByState();
      // resetQuerySoqlState();
    } else if (!selectedOrg) {
      // resetSobjects();
      // resetSelectedSObject();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg, priorSelectedOrg]);

  return (
    <Fragment>
      <StateDebugObserver
        name="PERMISSION SNAPSHOT"
        atoms={[
          ['sObjectsState', fromPermissionsStateState.sObjectsState],
          ['selectedSObjectsState', fromPermissionsStateState.selectedSObjectsState],
          ['profilesState', fromPermissionsStateState.profilesState],
          ['selectedProfilesPermSetState', fromPermissionsStateState.selectedProfilesPermSetState],
          ['permissionSetsState', fromPermissionsStateState.permissionSetsState],
          ['selectedPermissionSetsState', fromPermissionsStateState.selectedPermissionSetsState],
          ['fieldsByObject', fromPermissionsStateState.fieldsByObject],
          ['fieldsByKey', fromPermissionsStateState.fieldsByKey],
          ['objectPermissionMap', fromPermissionsStateState.objectPermissionMap],
          ['fieldPermissionMap', fromPermissionsStateState.fieldPermissionMap],
        ]}
      />
      <Switch>
        <Route path={`${match.url}`} exact>
          <ManagePermissionsSelection />
        </Route>
        <Route path={`${match.url}/editor`}>{hasSelectionsMade ? <ManagePermissionsEditor /> : <Redirect to={match.url} />}</Route>
      </Switch>
    </Fragment>
  );
};

export default Query;
