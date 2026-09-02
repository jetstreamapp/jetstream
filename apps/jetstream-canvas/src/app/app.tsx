import { AppToast, ConfirmationServiceProvider, SkipToContent } from '@jetstream/ui';
import {
  AppLoading,
  AppMainContent,
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
            {/* First in DOM order so it is the first tab stop even while a toast or modal is mounted */}
            <SkipToContent />
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
              <AppMainContent>
                <Suspense fallback={<AppLoading />}>
                  <ErrorBoundary FallbackComponent={ErrorBoundaryFallback}>
                    <AppRoutes />
                  </ErrorBoundary>
                </Suspense>
              </AppMainContent>
            </div>
          </AppInitializer>
        </Suspense>
      </ConfirmationServiceProvider>
    </ErrorBoundary>
  );
};

export default App;
