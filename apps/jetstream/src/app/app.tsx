import { Announcement } from '@jetstream/types';
import { AppToast, ConfirmationServiceProvider, SkipToContent, UserFeedbackWidget } from '@jetstream/ui';
import {
  AppLoading,
  AppMainContent,
  DownloadFileStream,
  ErrorBoundaryEmptyFallback,
  ErrorBoundaryFallback,
  HeaderNavbar,
  ThemeApplier,
  ViewEditCloneRecordWrapper,
} from '@jetstream/ui-core';
import { Suspense, useState } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import ModalContainer from 'react-modal-promise';
import { environment } from '../environments/environment';
import { AppRoutes } from './AppRoutes';
import { AnnouncementAlerts } from './components/core/AnnouncementAlerts';
import AppInitializer from './components/core/AppInitializer';
import AppStateResetOnOrgChange from './components/core/AppStateResetOnOrgChange';
import LogInitializer from './components/core/LogInitializer';
import './components/core/monaco-loader';
import NotificationsRequestModal from './components/core/NotificationsRequestModal';

export const App = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  return (
    <ErrorBoundary FallbackComponent={ErrorBoundaryFallback}>
      <ConfirmationServiceProvider>
        <Suspense fallback={<AppLoading />}>
          <AppInitializer onAnnouncements={setAnnouncements}>
            <ThemeApplier />
            {/* First in DOM order so it is the first tab stop even while a toast or modal is mounted */}
            <SkipToContent />
            <ModalContainer />
            <AppStateResetOnOrgChange />
            <AppToast />
            <LogInitializer />
            {/* TODO: we don't need/want to show this for read only user (e.g. billing only user) */}
            <NotificationsRequestModal loadDelay={10000} />
            <DownloadFileStream />
            <ViewEditCloneRecordWrapper />
            <div>
              <div data-testid="header">
                <HeaderNavbar isBillingEnabled={environment.BILLING_ENABLED} />
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
        </Suspense>
      </ConfirmationServiceProvider>
    </ErrorBoundary>
  );
};

export default App;
