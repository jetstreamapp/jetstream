import { Maybe, UserProfileUi } from '@jetstream/types';
import { AppToast, ConfirmationServiceProvider } from '@jetstream/ui';
// import { initSocket } from '@jetstream/shared/data';
import { ClerkProvider, RedirectToSignIn, SignedOut } from '@clerk/clerk-react';
import { AppLoading, DownloadFileStream, ErrorBoundaryFallback, HeaderNavbar, HeaderNavbarProps } from '@jetstream/ui-core';
import { OverlayProvider } from '@react-aria/overlays';
import { Suspense, useEffect, useMemo, useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { ErrorBoundary } from 'react-error-boundary';
import ModalContainer from 'react-modal-promise';
import { RecoilRoot } from 'recoil';
import { environment } from '../environments/environment';
import { AppRoutes } from './AppRoutes';
import AppInitializer from './components/core/AppInitializer';
import AppStateResetOnOrgChange from './components/core/AppStateResetOnOrgChange';
import LogInitializer from './components/core/LogInitializer';
import NotificationsRequestModal from './components/core/NotificationsRequestModal';
import Settings from './components/settings/Settings';

export const App = () => {
  const [userProfile, setUserProfile] = useState<Maybe<UserProfileUi>>();
  const [featureFlags, setFeatureFlags] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (userProfile && userProfile[environment.authAudience || '']?.featureFlags) {
      const flags = new Set<string>(userProfile[environment.authAudience || ''].featureFlags.flags);
      setFeatureFlags(flags);
    }
  }, [userProfile]);

  const accountPages = useMemo<HeaderNavbarProps['accountPages']>(() => {
    return [
      {
        label: 'Settings',
        url: 'settings',
        icon: { type: 'utility', icon: 'settings' },
        content: <Settings />,
      },
    ];
  }, []);

  return (
    <ClerkProvider
      publishableKey={environment.clerkPublishableKey}
      afterSignOutUrl={environment.serverUrl}
      signInUrl={`${environment.serverUrl}/sign-in`}
      signUpUrl={`${environment.serverUrl}/sign-up`}
      supportEmail="support@getjetstream.app"
      touchSession
      appearance={{
        layout: {
          helpPageUrl: 'https://docs.getjetstream.app/',
          privacyPageUrl: 'https://getjetstream.app/privacy',
          termsPageUrl: 'https://getjetstream.app/terms',
        },
      }}
    >
      <SignedOut>
        <RedirectToSignIn />
      </SignedOut>
      <ConfirmationServiceProvider>
        <RecoilRoot>
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
                      <HeaderNavbar userProfile={userProfile} featureFlags={featureFlags} accountPages={accountPages} />
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
        </RecoilRoot>
      </ConfirmationServiceProvider>
    </ClerkProvider>
  );
};

export default App;
