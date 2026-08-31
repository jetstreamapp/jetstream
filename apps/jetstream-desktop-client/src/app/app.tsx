import { css } from '@emotion/react';
import { Announcement } from '@jetstream/types';
import { AppToast, ConfirmationServiceProvider, SkipToContent, UserFeedbackWidget } from '@jetstream/ui';
import {
  AppLoading,
  AppMainContent,
  ErrorBoundaryEmptyFallback,
  ErrorBoundaryFallback,
  HeaderNavbar,
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
              {/* First in DOM order so it is the first tab stop even while a toast or modal is mounted */}
              <SkipToContent />
              <ModalContainer />
              <AppStateResetOnOrgChange />
              <AppToast />
              <LogInitializer />
              <NotificationsRequestModal loadDelay={10000} />
              <DownloadFileStreamDesktop />
              <ViewEditCloneRecordWrapper />
              <div>
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
                <AppMainContent>
                  <AnnouncementAlerts announcements={announcements} />
                  <Suspense fallback={<AppLoading />}>
                    <ErrorBoundary FallbackComponent={ErrorBoundaryFallback}>
                      <AppRoutes />
                    </ErrorBoundary>
                  </Suspense>
                </AppMainContent>
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
