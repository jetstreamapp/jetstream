import { AppToast, ConfirmationServiceProvider } from '@jetstream/ui';
import {
  AppLoading,
  DownloadFileStream,
  ErrorBoundaryFallback,
  HeaderNavbar,
  ThemeApplier,
  ViewEditCloneRecordWrapper,
} from '@jetstream/ui-core';
import { Suspense } from 'react';
import { ErrorBoundary } from 'react-error-boundary';
import ModalContainer from 'react-modal-promise';
import z from 'zod';
import { AppRoutes } from './AppRoutes';
import AppInitializer from './core/AppInitializer';
import './core/monaco-loader';
import { useCanvasColorScheme } from './core/useCanvasColorScheme';

const Sfdc = window.Sfdc;

// The fullscreen VF page passes { isFullScreen: true } via the apex:canvasApp parameters attribute
const isFullscreen = z
  .preprocess((val) => (val === undefined ? true : val), z.coerce.boolean())
  .parse(sr.context?.environment?.parameters?.isFullScreen);

export const App = () => {
  const [colorScheme, setColorScheme] = useCanvasColorScheme();

  return (
    <ErrorBoundary FallbackComponent={ErrorBoundaryFallback}>
      <ConfirmationServiceProvider>
        <Suspense fallback={<AppLoading />}>
          <AppInitializer>
            <ThemeApplier forceScheme={colorScheme} />
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
                  colorScheme={colorScheme}
                  onColorSchemeChange={setColorScheme}
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
          </AppInitializer>
        </Suspense>
      </ConfirmationServiceProvider>
    </ErrorBoundary>
  );
};

export default App;
