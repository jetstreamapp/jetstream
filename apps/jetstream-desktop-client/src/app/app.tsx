import { css } from '@emotion/react';
import { Announcement } from '@jetstream/types';
import { AppToast, ConfirmationServiceProvider } from '@jetstream/ui';
import { AppLoading, DownloadFileStream, ErrorBoundaryFallback, HeaderNavbar } from '@jetstream/ui-core';
import { Suspense, useState } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { ErrorBoundary } from 'react-error-boundary';
import ModalContainer from 'react-modal-promise';
import { AppRoutes } from './AppRoutes';
import { AnnouncementAlerts } from './components/core/AnnouncementAlerts';
import AppInitializer from './components/core/AppInitializer';
import AppStateResetOnOrgChange from './components/core/AppStateResetOnOrgChange';
import { Login } from './components/core/Login';
import LogInitializer from './components/core/LogInitializer';
import './components/core/monaco-loader';
import NotificationsRequestModal from './components/core/NotificationsRequestModal';
import { addDesktopOrg } from './utils/utils';

export const App = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);

  function handleMenuAction(action: string) {
    // Handle menu actions from Windows menu bar
    switch (action) {
      case 'new-window':
        window.electronAPI?.openNewWindow();
        break;
      case 'quit':
        window.electronAPI?.quit();
        break;
      case 'undo':
        document.execCommand('undo');
        break;
      case 'redo':
        document.execCommand('redo');
        break;
      case 'cut':
        document.execCommand('cut');
        break;
      case 'copy':
        document.execCommand('copy');
        break;
      case 'paste':
        document.execCommand('paste');
        break;
      case 'select-all':
        document.execCommand('selectAll');
        break;
      case 'reload':
        window.location.reload();
        break;
      case 'force-reload':
        window.location.reload();
        break;
      case 'toggle-devtools':
        window.electronAPI?.toggleDevTools();
        break;
      case 'reset-zoom':
        window.electronAPI?.resetZoom();
        break;
      case 'zoom-in':
        window.electronAPI?.zoomIn();
        break;
      case 'zoom-out':
        window.electronAPI?.zoomOut();
        break;
      case 'toggle-fullscreen':
        window.electronAPI?.toggleFullscreen();
        break;
      case 'minimize':
        window.electronAPI?.minimize();
        break;
      case 'close':
        window.electronAPI?.close();
        break;
      case 'documentation':
        window.open('https://docs.getjetstream.app/', '_blank');
        break;
      case 'report-issue':
        window.open('https://github.com/jetstreamapp/jetstream/issues', '_blank');
        break;
      case 'email-support':
        window.open('mailto:support@getjetstream.app', '_blank');
        break;
      default:
        break;
    }
  }

  return (
    <ConfirmationServiceProvider>
      <Suspense fallback={<AppLoading />}>
        <Login>
          {({ onLogout, authInfo }) => (
            <AppInitializer authInfo={authInfo} onAnnouncements={setAnnouncements}>
              <DndProvider backend={HTML5Backend}>
                <ModalContainer />
                <AppStateResetOnOrgChange />
                <AppToast />
                <LogInitializer />
                <NotificationsRequestModal loadDelay={10000} />
                <DownloadFileStream />
                <div>
                  <div
                    css={css`
                      -webkit-app-region: drag;
                    `}
                    data-testid="header"
                  >
                    <HeaderNavbar
                      logoCss={css`
                        background-image: none !important;
                      `}
                      isDesktop
                      isBillingEnabled={false}
                      onMenuAction={handleMenuAction}
                      onAddOrgHandlerFn={addDesktopOrg}
                      onLogoutHandlerFn={onLogout}
                    />
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
          )}
        </Login>
      </Suspense>
    </ConfirmationServiceProvider>
  );
};

export default App;
