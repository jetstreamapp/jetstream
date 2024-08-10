/* eslint-disable no-restricted-globals */
import { enableLogger } from '@jetstream/shared/client-logger';
import { AppToast, ConfirmationServiceProvider } from '@jetstream/ui';
import { AppLoading } from '@jetstream/ui-core';
import { OverlayProvider } from '@react-aria/overlays';
import '@salesforce-ux/design-system/assets/styles/salesforce-lightning-design-system.min.css';
import { ReactNode, Suspense } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import ModalContainer from 'react-modal-promise';
import { MemoryRouter } from 'react-router-dom';
import { RecoilRoot } from 'recoil';
import '../main.scss';
import '../utils/monaco-loader';
import AppInitializer from './AppInitializer';

enableLogger(true);

export function AppWrapper({ children }: { children: ReactNode }) {
  return (
    <ConfirmationServiceProvider>
      <RecoilRoot>
        <Suspense fallback={<AppLoading />}>
          <MemoryRouter>
            <AppInitializer
              onUserProfile={() => {
                // TODO:
              }}
            >
              <OverlayProvider>
                <DndProvider backend={HTML5Backend}>
                  <ModalContainer />
                  {/* <AppStateResetOnOrgChange /> */}
                  <AppToast />
                  {/* <LogInitializer /> */}
                  {/* <NotificationsRequestModal loadDelay={10000} featureFlags={featureFlags} /> */}
                  {/* <DownloadFileStream /> */}
                  {children}
                </DndProvider>
              </OverlayProvider>
            </AppInitializer>
          </MemoryRouter>
        </Suspense>
      </RecoilRoot>
    </ConfirmationServiceProvider>
  );
}
