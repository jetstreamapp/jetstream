import { css } from '@emotion/react';
import { Announcement } from '@jetstream/types';
import { AppToast, ConfirmationServiceProvider, SkipToContent, UserFeedbackWidget } from '@jetstream/ui';
import {
  AppLoading,
  ErrorBoundaryEmptyFallback,
  ErrorBoundaryFallback,
  FocusMainContentOnRouteChange,
  HeaderNavbar,
  MAIN_CONTENT_ID,
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
import { DownloadFileStreamDesktop } from './components/core/DownloadFileStreamDesktop';
import { Login } from './components/core/Login';
import LogInitializer from './components/core/LogInitializer';
import './components/core/monaco-loader';
import NotificationsRequestModal from './components/core/NotificationsRequestModal';
import { addDesktopOrg } from './utils/utils';

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
              <AppStateResetOnOrgChange />
              <AppToast />
              <LogInitializer />
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
              {/* Rendered after the content so the floating button is the LAST tab stop on the page, not the first. */}
              <ErrorBoundary FallbackComponent={ErrorBoundaryEmptyFallback}>
                <UserFeedbackWidget />
              </ErrorBoundary>
            </AppInitializer>
          )}
        </Login>
      </Suspense>
    </ConfirmationServiceProvider>
  );
};

export default App;
