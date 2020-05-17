import React, { Fragment, FunctionComponent } from 'react';
import { Redirect, Route, Switch, useLocation, useRouteMatch } from 'react-router-dom';
import QueryBuilder from './QueryBuilder';
import QueryResults from './QueryResults';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface QueryProps {}

export const Query: FunctionComponent<QueryProps> = () => {
  const match = useRouteMatch();
  const location = useLocation<{ soql: string }>();

  return (
    <Fragment>
      <Switch>
        <Route path={`${match.url}`} exact={true}>
          <QueryBuilder />
        </Route>
        <Route path={`${match.url}/results`}>{!location.state?.soql ? <Redirect to={match.url} /> : <QueryResults />}</Route>
      </Switch>
    </Fragment>
  );
};

export default Query;
