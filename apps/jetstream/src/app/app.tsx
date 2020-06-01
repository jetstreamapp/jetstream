/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { Header } from '@jetstream/ui';
import Query from './components/query/Query';
import { BrowserRouter as Router, Switch, Route } from 'react-router-dom';
import { Navbar } from '@jetstream/ui';
import { NavbarItem } from '@jetstream/ui';
import Logo from '../assets/jetstream-logo-v1-200w.png';

export const App = () => {
  return (
    <Router>
      <div>
        <div>
          <Header logo={Logo}>
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
