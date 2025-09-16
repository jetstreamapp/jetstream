import { Announcement } from '@jetstream/types';
import { AppToast, ConfirmationServiceProvider } from '@jetstream/ui';
import { AppLoading, DownloadFileStream, ErrorBoundaryFallback, HeaderNavbar, ViewEditCloneRecordWrapper } from '@jetstream/ui-core';
import { Suspense, useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
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
            <DndProvider backend={HTML5Backend}>
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
                <div className="app-container slds-p-horizontal_xx-small slds-p-vertical_xx-small" data-testid="content">
                  <AnnouncementAlerts announcements={announcements} />
                  <Suspense fallback={<AppLoading />}>
                    <ErrorBoundary FallbackComponent={ErrorBoundaryFallback}>
                      <AppRoutes />
                    </ErrorBoundary>
                  </Suspense>
                </div>
              </div>
            </DndProvider>
          </AppInitializer>
        </Suspense>
      </ConfirmationServiceProvider>
    </ErrorBoundary>
  );
};

export default App;
