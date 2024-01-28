import { AppLoading, HeaderNavbar, NotificationsRequestModal } from '@jetstream/core/shared-ui';
import { Maybe, UserProfileUi } from '@jetstream/types';
import { AppToast, ConfirmationServiceProvider, ErrorBoundaryFallback } from '@jetstream/ui';
import { OverlayProvider } from '@react-aria/overlays';
import { Suspense, useEffect, useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { ErrorBoundary } from 'react-error-boundary';
import ModalContainer from 'react-modal-promise';
import { useRecoilValue } from 'recoil';
import { environment } from '../environments/environment';
import { AppRoutes } from './AppRoutes';
import { selectedOrgState } from './app-state';
import AppInitializer from './components/core/AppInitializer';
import AppStateResetOnOrgChange from './components/core/AppStateResetOnOrgChange';
import { DownloadFileStream } from './components/core/DownloadFileStream';
import LogInitializer from './components/core/LogInitializer';
import './components/core/monaco-loader';
import OrgsDropdown from './components/orgs/OrgsDropdown';

/**
 * TODO: disabled socket from browser until we have a solid use-case for it
 * previously this was used for platform events, but that was moved to browser
 */
// initSocket();

export const App = () => {
  const [userProfile, setUserProfile] = useState<Maybe<UserProfileUi>>();
  const [featureFlags, setFeatureFlags] = useState<Set<string>>(new Set());
  const selectedOrg = useRecoilValue(selectedOrgState);

  useEffect(() => {
    if (userProfile && userProfile[environment.authAudience || '']?.featureFlags) {
      const flags = new Set<string>(userProfile[environment.authAudience || ''].featureFlags.flags);
      setFeatureFlags(flags);
    }
  }, [userProfile]);

  return (
    <ConfirmationServiceProvider>
      <Suspense fallback={<AppLoading />}>
        <AppInitializer onUserProfile={setUserProfile}>
          <OverlayProvider>
            <DndProvider backend={HTML5Backend}>
              <ModalContainer />
              <AppStateResetOnOrgChange />
              <AppToast />
              <LogInitializer />
              <NotificationsRequestModal featureFlags={featureFlags} loadDelay={10000} />
              <DownloadFileStream />
              <div>
                <div data-testid="header">
                  <HeaderNavbar
                    selectedOrg={selectedOrg}
                    orgsDropdown={<OrgsDropdown />}
                    userProfile={userProfile}
                    featureFlags={featureFlags}
                  />
                </div>
                <div className="app-container slds-p-horizontal_xx-small slds-p-vertical_xx-small" data-testid="content">
                  <Suspense fallback={<AppLoading />}>
                    <ErrorBoundary FallbackComponent={ErrorBoundaryFallback}>
                      <AppRoutes featureFlags={featureFlags} userProfile={userProfile} />
                    </ErrorBoundary>
                  </Suspense>
                </div>
              </div>
            </DndProvider>
          </OverlayProvider>
        </AppInitializer>
      </Suspense>
    </ConfirmationServiceProvider>
  );
};

export default App;
