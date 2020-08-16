import { SalesforceOrgUi } from '@jetstream/types';
import React, { Fragment, FunctionComponent, useState, useEffect } from 'react';
import { Redirect, Route, Switch, useLocation, useRouteMatch } from 'react-router-dom';
import { useRecoilValue, useResetRecoilState } from 'recoil';
import { selectedOrgState } from '../../app-state';
import QueryBuilder from './QueryBuilder/QueryBuilder';
import QueryResults from './QueryResults/QueryResults';
import * as fromQueryState from './query.state';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface QueryProps {}

export const Query: FunctionComponent<QueryProps> = () => {
  const match = useRouteMatch();
  const location = useLocation<{ soql: string }>();
  const resetSobjects = useResetRecoilState(fromQueryState.sObjectsState);
  const resetSelectedSObject = useResetRecoilState(fromQueryState.selectedSObjectState);
  const resetQueryFieldsKey = useResetRecoilState(fromQueryState.queryFieldsKey);
  const resetQueryFieldsMapState = useResetRecoilState(fromQueryState.queryFieldsMapState);
  const resetSelectedQueryFieldsState = useResetRecoilState(fromQueryState.selectedQueryFieldsState);
  const resetSelectedSubqueryFieldsState = useResetRecoilState(fromQueryState.selectedSubqueryFieldsState);
  const resetQueryFiltersState = useResetRecoilState(fromQueryState.queryFiltersState);
  const resetQueryLimitSkip = useResetRecoilState(fromQueryState.queryLimitSkip);
  const resetQueryOrderByState = useResetRecoilState(fromQueryState.queryOrderByState);
  const resetQuerySoqlState = useResetRecoilState(fromQueryState.querySoqlState);
  const [priorSelectedOrg, setPriorSelectedOrg] = useState<string>(null);

  // FIXME: Cannot update a component (`Batcher`) while rendering a different component (`Query`)
  // Recoil needs to fix this
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);

  // reset everything if the selected org changes
  useEffect(() => {
    if (selectedOrg && priorSelectedOrg !== selectedOrg.uniqueId) {
      if (!priorSelectedOrg) {
        setPriorSelectedOrg(selectedOrg.uniqueId);
      } else {
        // resetting these does not work ;(
        setPriorSelectedOrg(selectedOrg.uniqueId);
        resetSobjects();
        resetSelectedSObject();
        resetQueryFieldsKey();
        resetQueryFieldsMapState();
        resetSelectedQueryFieldsState();
        resetSelectedSubqueryFieldsState();
        resetQueryFiltersState();
        resetQueryLimitSkip();
        resetQueryOrderByState();
        resetQuerySoqlState();
      }
    } else if (!selectedOrg) {
      resetSobjects();
      resetSelectedSObject();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg, priorSelectedOrg]);

  return (
    <Fragment>
      <Switch>
        <Route path={`${match.url}`} exact>
          <QueryBuilder />
        </Route>
        <Route path={`${match.url}/results`}>{!location.state?.soql ? <Redirect to={match.url} /> : <QueryResults />}</Route>
      </Switch>
    </Fragment>
  );
};

export default Query;
