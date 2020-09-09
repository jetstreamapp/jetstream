/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { UserProfileUi } from '@jetstream/types';
import { ConfirmationServiceProvider } from '@jetstream/ui';
import { Suspense, useState, lazy } from 'react';
import { BrowserRouter as Router, Route, Switch, Redirect } from 'react-router-dom';
import { RecoilRoot } from 'recoil';
import AppInitializer from './components/core/AppInitializer';
import HeaderNavbar from './components/core/HeaderNavbar';
import OrgSelectionRequired from './components/orgs/OrgSelectionRequired';
import { ErrorBoundary } from 'react-error-boundary';
import ErrorBoundaryFallback from './components/core/ErrorBoundaryFallback';

const Query = lazy(() => import('./components/query/Query'));
const Feedback = lazy(() => import('./components/feedback/Feedback'));

export const App = () => {
  const [userProfile, setUserProfile] = useState<UserProfileUi>();

  return (
    <ConfirmationServiceProvider>
      <RecoilRoot>
        {/* TODO: make better loading indicators for suspense (both global and localized versions - maybe SVG placeholders) */}
        <Suspense fallback={<div>Loading...</div>}>
          <AppInitializer onUserProfile={setUserProfile}>
            <Router basename="/app">
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
                    <ErrorBoundary FallbackComponent={ErrorBoundaryFallback}>
                      <OrgSelectionRequired>
                        <Switch>
                          <Route path="/query">
                            <Query />
                          </Route>
                          <Route path="/feedback">
                            <Feedback />
                          </Route>
                          <Route path="*">
                            <Redirect to="/query" />
                          </Route>
                        </Switch>
                      </OrgSelectionRequired>
                    </ErrorBoundary>
                  </Suspense>
                </div>
              </div>
            </Router>
          </AppInitializer>
        </Suspense>
      </RecoilRoot>
    </ConfirmationServiceProvider>
  );
};

export default App;
