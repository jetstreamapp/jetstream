import { enableLogger } from '@jetstream/shared/client-logger';
import { AxiosAdapterConfig } from '@jetstream/shared/data';
import { AppToast, ConfirmationServiceProvider } from '@jetstream/ui';
import { AppLoading } from '@jetstream/ui-core';
import { OverlayProvider } from '@react-aria/overlays';
import '@salesforce-ux/design-system/assets/styles/salesforce-lightning-design-system.css';
import { ReactNode, Suspense } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import ModalContainer from 'react-modal-promise';
import { MemoryRouter } from 'react-router-dom';
import { RecoilRoot } from 'recoil';
import RecoilNexus from 'recoil-nexus';
import { environment } from '../environments/environment';
import '../main.scss';
import { browserExtensionAxiosAdapter } from '../utils/extension-axios-adapter';
import '../utils/monaco-loader';
import AppInitializer from './AppInitializer';

if (!environment.production) {
  enableLogger(true);
}

AxiosAdapterConfig.adapter = browserExtensionAxiosAdapter;

export function AppWrapper({ allowWithoutSalesforceOrg, children }: { allowWithoutSalesforceOrg?: boolean; children: ReactNode }) {
  return (
    <ConfirmationServiceProvider>
      <RecoilRoot>
        <RecoilNexus />
        <Suspense fallback={<AppLoading />}>
          <MemoryRouter>
            <AppInitializer allowWithoutSalesforceOrg={allowWithoutSalesforceOrg}>
              <OverlayProvider>
                <DndProvider backend={HTML5Backend}>
                  <ModalContainer />
                  <AppToast />
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
