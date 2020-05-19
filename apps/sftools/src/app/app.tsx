/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { Header } from '@silverthorn/ui';
import Query from './components/query/Query';
import { BrowserRouter as Router, Switch, Route } from 'react-router-dom';
import { Navbar } from '@silverthorn/ui';
import { NavbarItem } from '@silverthorn/ui';

export const App = () => {
  return (
    <Router>
      <div>
        <div>
          <Header>
            <Navbar>
              <NavbarItem path="/" title="Home" label="Home" />
              <NavbarItem path="/query" title="Query Records" label="Query Records" />
            </Navbar>
          </Header>
        </div>
        <div
          className="slds-p-horizontal_small slds-p-vertical_xx-small"
          css={css`
            margin-top: 90px;
          `}
        >
          <Switch>
            <Route path="/query">
              <Query />
            </Route>
          </Switch>
        </div>
      </div>
    </Router>
  );
};

export default App;
