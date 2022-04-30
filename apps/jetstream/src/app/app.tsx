import { css } from '@emotion/react';
import { UserProfileUi } from '@jetstream/types';
import { ConfirmationServiceProvider } from '@jetstream/ui';
// import { initSocket } from '@jetstream/shared/data';
import { OverlayProvider } from '@react-aria/overlays';
import React, { Suspense, useEffect, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import ModalContainer from 'react-modal-promise';
import { RecoilRoot } from 'recoil';
import { AppRoutes } from './AppRoutes';
import AppInitializer from './components/core/AppInitializer';
import AppStateResetOnOrgChange from './components/core/AppStateResetOnOrgChange';
import AppToast from './components/core/AppToast';
import ErrorBoundaryFallback from './components/core/ErrorBoundaryFallback';
import HeaderNavbar from './components/core/HeaderNavbar';
import LogInitializer from './components/core/LogInitializer';
import './components/core/monaco-loader';
import NotificationsRequestModal from './components/core/NotificationsRequestModal';

/**
 * TODO: disabled socket from browser until we have a solid use-case for it
 * previously this was used for platform events, but that was moved to browser
 */
// initSocket();

export const App = () => {
  const [userProfile, setUserProfile] = useState<UserProfileUi>();
  const [featureFlags, setFeatureFlags] = useState<Set<string>>(new Set());
  // This was causing feature flag blocked routes to change on reload in local dev
  // const [routes, setRoutes] = useState<RouteItem[]>(() => ROUTES.filter((route) => !route.flag));

  useEffect(() => {
    if (userProfile && userProfile['http://getjetstream.app/app_metadata']?.featureFlags) {
      const flags = new Set<string>(userProfile['http://getjetstream.app/app_metadata'].featureFlags.flags);
      // setRoutes(ROUTES.filter((route) => !route.flag || hasFeatureFlagAccess(flags, route.flag)));
      setFeatureFlags(flags);
    }
  }, [userProfile]);

  return (
    <ConfirmationServiceProvider>
      <RecoilRoot>
        {/* TODO: make better loading indicators for suspense (both global and localized versions - maybe SVG placeholders) */}
        <Suspense fallback={<div>Loading...</div>}>
          <AppInitializer onUserProfile={setUserProfile}>
            <OverlayProvider>
              {/* <React.StrictMode> */}
              <ModalContainer />
              <AppStateResetOnOrgChange />
              <AppToast />
              <LogInitializer />
              <NotificationsRequestModal featureFlags={featureFlags} loadDelay={10000} />
              <div>
                <div data-testid="header">
                  <HeaderNavbar userProfile={userProfile} featureFlags={featureFlags} />
                </div>
                <div
                  className="slds-p-horizontal_xx-small slds-p-vertical_xx-small"
                  css={css`
                    margin-top: 90px;
                  `}
                  data-testid="content"
                >
                  <Suspense fallback={<div>Loading...</div>}>
                    <ErrorBoundary FallbackComponent={ErrorBoundaryFallback}>
                      <AppRoutes featureFlags={featureFlags} userProfile={userProfile} />
                    </ErrorBoundary>
                  </Suspense>
                </div>
              </div>
              {/* </React.StrictMode> */}
            </OverlayProvider>
          </AppInitializer>
        </Suspense>
      </RecoilRoot>
    </ConfirmationServiceProvider>
  );
};

export default App;
