/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import Header from './components/core/Header';
import Query from './components/query/Query';
import { BrowserRouter as Router, Switch, Route } from 'react-router-dom';
import Navbar from './components/core/NavBar';
import NavBarItem from './components/core/NavBarItem';

export const App = () => {
  return (
    <Router>
      <div>
        <div>
          <Header>
            <Navbar>
              <NavBarItem path="/" title="Home" label="Home" />
              <NavBarItem path="/query" title="Query Records" label="Query Records" />
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
