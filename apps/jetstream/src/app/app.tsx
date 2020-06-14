/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { UserProfile } from '@jetstream/types';
import { Suspense, useState } from 'react';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import { RecoilRoot } from 'recoil';
import FetchUserProfile from './components/core/FetchUserProfile';
import HeaderNavbar from './components/core/HeaderNavbar';
import Query from './components/query/Query';

export const App = () => {
  const [userProfile, setUserProfile] = useState<UserProfile>();

  return (
    <RecoilRoot>
      {/* TODO: make better loading indicators for suspense (both global and localized versions - maybe SVG placeholders) */}
      <Suspense fallback={<div>Loading...</div>}>
        <FetchUserProfile onUserProfile={setUserProfile}>
          <Router>
            <div>
              <div>
                <HeaderNavbar userProfile={userProfile} />
              </div>
              <div
                className="slds-p-horizontal_small slds-p-vertical_xx-small"
                css={css`
                  margin-top: 90px;
                `}
              >
                <Suspense fallback={<div>Loading...</div>}>
                  <Switch>
                    <Route path="/query">
                      <Query />
                    </Route>
                  </Switch>
                </Suspense>
              </div>
            </div>
          </Router>
        </FetchUserProfile>
      </Suspense>
    </RecoilRoot>
  );
};

export default App;
