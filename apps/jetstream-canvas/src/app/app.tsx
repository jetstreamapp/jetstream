import { AppToast, ConfirmationServiceProvider } from '@jetstream/ui';
import { AppLoading, DownloadFileStream, ErrorBoundaryFallback, HeaderNavbar, ViewEditCloneRecordWrapper } from '@jetstream/ui-core';
import { Suspense } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { ErrorBoundary } from 'react-error-boundary';
import ModalContainer from 'react-modal-promise';
import z from 'zod';
import { AppRoutes } from './AppRoutes';
import AppInitializer from './core/AppInitializer';
import './core/monaco-loader';

const Sfdc = window.Sfdc;

// The fullscreen VF page passes { isFullScreen: true } via the apex:canvasApp parameters attribute
const isFullscreen = z.coerce.boolean().default(true).parse(sr.context?.environment?.parameters?.isFullScreen);

export const App = () => {
  return (
    <ErrorBoundary FallbackComponent={ErrorBoundaryFallback}>
      <ConfirmationServiceProvider>
        <Suspense fallback={<AppLoading />}>
          <AppInitializer>
            <DndProvider backend={HTML5Backend}>
              <ModalContainer />
              <AppToast />
              <DownloadFileStream />
              <ViewEditCloneRecordWrapper />
              <div>
                <div data-testid="header">
                  <HeaderNavbar
                    isEmbeddedApp
                    isFullscreen={isFullscreen}
                    isBillingEnabled={false}
                    onLogoutHandlerFn={() => Sfdc.canvas.oauth.logout()}
                  />
                </div>
                <div className="app-container slds-p-horizontal_xx-small slds-p-vertical_xx-small" data-testid="content">
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
