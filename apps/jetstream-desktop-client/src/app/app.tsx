import { css } from '@emotion/react';
import { Announcement } from '@jetstream/types';
import { AppToast, ConfirmationServiceProvider, SkipToContent } from '@jetstream/ui';
import {
  AppLoading,
  ErrorBoundaryFallback,
  FocusMainContentOnRouteChange,
  HeaderNavbar,
  MAIN_CONTENT_ID,
  NotificationsRequestModal,
  ThemeApplier,
  ViewEditCloneRecordWrapper,
} from '@jetstream/ui-core';
import { Suspense, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import ModalContainer from 'react-modal-promise';
import { AppRoutes } from './AppRoutes';
import { AnnouncementAlerts } from './components/core/AnnouncementAlerts';
import AppInitializer from './components/core/AppInitializer';
import AppStateResetOnOrgChange from './components/core/AppStateResetOnOrgChange';
import { DesktopPreferencesSync } from './components/core/DesktopPreferencesSync';
import { DownloadFileStreamDesktop } from './components/core/DownloadFileStreamDesktop';
import lazy from './components/core/LazyLoad';
import { Login } from './components/core/Login';
import LogInitializer from './components/core/LogInitializer';
import './components/core/monaco-loader';
import { addDesktopOrg, isSettingsWindow } from './utils/utils';

const Settings = lazy(() => import('./components/settings/Settings'));

// Settings is the only page in the Settings window, so its code loads alongside sign-in instead of after it
if (isSettingsWindow()) {
  Settings.preload();
}

export const App = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  return (
    <ConfirmationServiceProvider>
      <Suspense fallback={<AppLoading />}>
        <Login>
          {({ onLogout, authInfo }) => (
            <AppInitializer authInfo={authInfo} onAnnouncements={setAnnouncements}>
              <ThemeApplier />
              <ModalContainer />
              <LogInitializer />
              <DesktopPreferencesSync />
              {isSettingsWindow() ? (
                // The Settings window has a native title bar and only ever shows the Settings page. It does not use
                // `app-container`, whose top margin makes room for the main window's fixed header.
                <div className="slds-p-horizontal_xx-small slds-p-vertical_xx-small" data-testid="content">
                  <Suspense fallback={<AppLoading />}>
                    <ErrorBoundary FallbackComponent={ErrorBoundaryFallback}>
                      <Settings />
                    </ErrorBoundary>
                  </Suspense>
                </div>
              ) : (
                <>
                  <AppStateResetOnOrgChange />
                  <NotificationsRequestModal loadDelay={10000} />
                  <DownloadFileStreamDesktop />
                  <ViewEditCloneRecordWrapper />
                  <FocusMainContentOnRouteChange />
                  <div>
                    <SkipToContent />
                    <div
                      css={css`
                        app-region: drag;
                      `}
                      data-testid="header"
                    >
                      <HeaderNavbar
                        logoCss={css`
                          background-image: none !important;
                        `}
                        isDesktop
                        isBillingEnabled={false}
                        onAddOrgHandlerFn={addDesktopOrg}
                        onLogoutHandlerFn={onLogout}
                      />
                    </div>
                    <main
                      id={MAIN_CONTENT_ID}
                      tabIndex={-1}
                      style={{ outline: 'none' }}
                      className="app-container slds-p-horizontal_xx-small slds-p-vertical_xx-small"
                      data-testid="content"
                    >
                      <AnnouncementAlerts announcements={announcements} />
                      <Suspense fallback={<AppLoading />}>
                        <ErrorBoundary FallbackComponent={ErrorBoundaryFallback}>
                          <AppRoutes />
                        </ErrorBoundary>
                      </Suspense>
                    </main>
                  </div>
                </>
              )}
              {/* Keep after the header so toast no-drag rects override its drag rect (see main.css) */}
              <AppToast />
            </AppInitializer>
          )}
        </Login>
      </Suspense>
    </ConfirmationServiceProvider>
  );
};

export default App;
