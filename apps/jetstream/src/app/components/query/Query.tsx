import React, { Fragment, FunctionComponent } from 'react';
import { Redirect, Route, Switch, useLocation, useRouteMatch } from 'react-router-dom';
import QueryBuilder from './QueryBuilder';
import QueryResults from './QueryResults';
import { useRecoilValue } from 'recoil';
import { SalesforceOrgUi } from '@jetstream/types';
import { selectedOrgState } from '../../app-state';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface QueryProps {}

export const Query: FunctionComponent<QueryProps> = () => {
  const match = useRouteMatch();
  const location = useLocation<{ soql: string }>();
  // FIXME: Cannot update a component (`Batcher`) while rendering a different component (`Query`)
  // Recoil needs to fix this
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);

  return (
    <Fragment>
      <Switch>
        <Route path={`${match.url}`} exact>
          <QueryBuilder key={selectedOrg?.uniqueId} />
        </Route>
        <Route path={`${match.url}/results`}>{!location.state?.soql ? <Redirect to={match.url} /> : <QueryResults />}</Route>
      </Switch>
    </Fragment>
  );
};

export default Query;
