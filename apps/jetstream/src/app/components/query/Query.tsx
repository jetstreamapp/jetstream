import { TITLES } from '@jetstream/shared/constants';
import { SalesforceOrgUi } from '@jetstream/types';
import { Spinner } from '@jetstream/ui';
import { Fragment, FunctionComponent, useCallback, useEffect, useState } from 'react';
import { Redirect, Route, Switch, useLocation, useRouteMatch } from 'react-router-dom';
import { useTitle } from 'react-use';
import { useRecoilValue, useResetRecoilState } from 'recoil';
import { selectedOrgState } from '../../app-state';
import StateDebugObserver from '../core/StateDebugObserver';
import * as fromQueryState from './query.state';
import QueryBuilder from './QueryBuilder/QueryBuilder';
import QueryResults from './QueryResults/QueryResults';
import useQueryRestore from './utils/useQueryRestore';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface QueryProps {}

export const Query: FunctionComponent<QueryProps> = () => {
  useTitle(TITLES.QUERY);
  const match = useRouteMatch();
  const location = useLocation<{ soql: string }>();
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  const querySoqlState = useRecoilValue(fromQueryState.querySoqlState);
  const isTooling = useRecoilValue(fromQueryState.isTooling);
  const resetSobjects = useResetRecoilState(fromQueryState.sObjectsState);
  const resetSelectedSObject = useResetRecoilState(fromQueryState.selectedSObjectState);
  const resetSObjectFilterTerm = useResetRecoilState(fromQueryState.sObjectFilterTerm);
  const resetQueryFieldsKey = useResetRecoilState(fromQueryState.queryFieldsKey);
  const resetQueryFieldsMapState = useResetRecoilState(fromQueryState.queryFieldsMapState);
  const resetSelectedQueryFieldsState = useResetRecoilState(fromQueryState.selectedQueryFieldsState);
  const resetSelectedSubqueryFieldsState = useResetRecoilState(fromQueryState.selectedSubqueryFieldsState);
  const resetQueryFiltersState = useResetRecoilState(fromQueryState.queryFiltersState);
  const resetQueryLimitSkip = useResetRecoilState(fromQueryState.queryLimitSkip);
  const resetQueryOrderByState = useResetRecoilState(fromQueryState.queryOrderByState);
  const resetQuerySoqlState = useResetRecoilState(fromQueryState.querySoqlState);
  const [priorSelectedOrg, setPriorSelectedOrg] = useState<string>(null);

  const [isRestoring, setIsRestoring] = useState(false);
  const startRestore = useCallback(() => setIsRestoring(true), []);
  const endRestore = useCallback(() => setIsRestoring(false), []);
  const [restore, errorMessage] = useQueryRestore(null, null, { startRestore: startRestore, endRestore: endRestore });

  // reset everything if the selected org changes
  useEffect(() => {
    if (selectedOrg && !priorSelectedOrg) {
      setPriorSelectedOrg(selectedOrg.uniqueId);
    } else if (selectedOrg && priorSelectedOrg !== selectedOrg.uniqueId) {
      const soql = querySoqlState;
      const tooling = isTooling;
      setPriorSelectedOrg(selectedOrg.uniqueId);
      resetSobjects();
      resetSelectedSObject();
      resetSObjectFilterTerm();
      resetQueryFieldsKey();
      resetQueryFieldsMapState();
      resetSelectedQueryFieldsState();
      resetSelectedSubqueryFieldsState();
      resetQueryFiltersState();
      resetQueryLimitSkip();
      resetQueryOrderByState();
      resetQuerySoqlState();

      if (match.url === '/query') {
        restore(soql, tooling);
      }
    } else if (!selectedOrg) {
      resetSobjects();
      resetSelectedSObject();
      resetSObjectFilterTerm();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg, priorSelectedOrg]);

  // safeguard to ensure that loading does not stay forever
  useEffect(() => {
    if (errorMessage && isRestoring) {
      setIsRestoring(false);
    }
  }, [errorMessage, isRestoring]);

  return (
    <Fragment>
      <StateDebugObserver
        name="QUERY SNAPSHOT"
        atoms={[
          ['selectedSObjectState', fromQueryState.selectedSObjectState],
          ['queryFieldsKey', fromQueryState.queryFieldsKey],
          ['queryFieldsMapState', fromQueryState.queryFieldsMapState],
          ['selectedQueryFieldsState', fromQueryState.selectedQueryFieldsState],
          ['selectedSubqueryFieldsState', fromQueryState.selectedSubqueryFieldsState],
          ['queryFiltersState', fromQueryState.queryFiltersState],
          ['queryLimit', fromQueryState.queryLimit],
          ['queryLimitSkip', fromQueryState.queryLimitSkip],
          ['queryOrderByState', fromQueryState.queryOrderByState],
        ]}
      />
      <Switch>
        <Route path={`${match.url}`} exact>
          {isRestoring && <Spinner />}
          <QueryBuilder />
        </Route>
        <Route path={`${match.url}/results`}>{!location.state?.soql ? <Redirect to={match.url} /> : <QueryResults />}</Route>
      </Switch>
    </Fragment>
  );
};

export default Query;
