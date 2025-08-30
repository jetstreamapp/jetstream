import { enableLogger } from '@jetstream/shared/client-logger';
import { AxiosAdapterConfig } from '@jetstream/shared/data';
import { AppToast, ConfirmationServiceProvider } from '@jetstream/ui';
import { AppLoading, ViewEditCloneRecordWrapper } from '@jetstream/ui-core';
import '@salesforce-ux/design-system/assets/styles/salesforce-lightning-design-system.css';
import { useAtomValue } from 'jotai';
import { ReactNode, Suspense } from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import ModalContainer from 'react-modal-promise';
import { MemoryRouter } from 'react-router-dom';
import { environment } from '../environments/environment';
import '../main.scss';
import { browserExtensionAxiosAdapter } from '../utils/extension-axios-adapter';
import { chromeStorageLoading } from '../utils/extension.store';
import '../utils/monaco-loader';
import AppInitializer from './AppInitializer';

if (!environment.production) {
  enableLogger(true);
}

AxiosAdapterConfig.adapter = browserExtensionAxiosAdapter;

export function AppWrapper({ allowWithoutSalesforceOrg, children }: { allowWithoutSalesforceOrg?: boolean; children: ReactNode }) {
  const isLoading = useAtomValue(chromeStorageLoading);
  if (isLoading) {
    return <AppLoading />;
  }
  return (
    <ConfirmationServiceProvider>
      <Suspense fallback={<AppLoading />}>
        <MemoryRouter>
          <AppInitializer allowWithoutSalesforceOrg={allowWithoutSalesforceOrg}>
            <DndProvider backend={HTML5Backend}>
              <ModalContainer />
              <AppToast />
              <ViewEditCloneRecordWrapper />
              {children}
            </DndProvider>
          </AppInitializer>
        </MemoryRouter>
      </Suspense>
    </ConfirmationServiceProvider>
  );
}
