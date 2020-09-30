/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { FEATURE_FLAGS } from '@jetstream/shared/constants';
import { hasFeatureFlagAccess } from '@jetstream/shared/ui-utils';
import { UserProfileUi } from '@jetstream/types';
import { ConfirmationServiceProvider } from '@jetstream/ui';
import { lazy, Suspense, useEffect, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import { BrowserRouter as Router, Route, Switch } from 'react-router-dom';
import { RecoilRoot } from 'recoil';
import AppInitializer from './components/core/AppInitializer';
import ErrorBoundaryFallback from './components/core/ErrorBoundaryFallback';
import HeaderNavbar from './components/core/HeaderNavbar';
import OrgSelectionRequired from './components/orgs/OrgSelectionRequired';

const Query = lazy(() => import('./components/query/Query'));
const AutomationControl = lazy(() => import('./components/automation-control/AutomationControl'));
const Feedback = lazy(() => import('./components/feedback/Feedback'));

export const App = () => {
  const [userProfile, setUserProfile] = useState<UserProfileUi>();
  const [featureFlags, setFeatureFlags] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (userProfile && userProfile['http://getjetstream.app/app_metadata']?.featureFlags) {
      setFeatureFlags(new Set<string>(userProfile['http://getjetstream.app/app_metadata'].featureFlags.flags));
    }
  }, [userProfile]);

  return (
    <ConfirmationServiceProvider>
      <RecoilRoot>
        {/* TODO: make better loading indicators for suspense (both global and localized versions - maybe SVG placeholders) */}
        <Suspense fallback={<div>Loading...</div>}>
          <AppInitializer onUserProfile={setUserProfile}>
            <Router basename="/app">
              <div>
                <div>
                  <HeaderNavbar userProfile={userProfile} featureFlags={featureFlags} />
                </div>
                <div
                  className="slds-p-horizontal_small slds-p-vertical_xx-small"
                  css={css`
                    margin-top: 90px;
                  `}
                >
                  <Suspense fallback={<div>Loading...</div>}>
                    <ErrorBoundary FallbackComponent={ErrorBoundaryFallback}>
                      <Switch>
                        {hasFeatureFlagAccess(featureFlags, FEATURE_FLAGS.QUERY) && (
                          <Route path="/query">
                            <OrgSelectionRequired>
                              <Query />
                            </OrgSelectionRequired>
                          </Route>
                        )}
                        {hasFeatureFlagAccess(featureFlags, FEATURE_FLAGS.AUTOMATION_CONTROL) && (
                          <Route path="/automation-control">
                            <OrgSelectionRequired>
                              <AutomationControl />
                            </OrgSelectionRequired>
                          </Route>
                        )}
                        <Route path="/feedback">
                          <Feedback />
                        </Route>
                        {/* This is taking precedence on reload ;( */}
                        {/* <Route path="*">
                          <Redirect to="/query" />
                        </Route> */}
                      </Switch>
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
