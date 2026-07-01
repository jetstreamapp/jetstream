import { enableLogger } from '@jetstream/shared/client-logger';
import { AxiosAdapterConfig } from '@jetstream/shared/data';
import { AppToast, ConfirmationServiceProvider } from '@jetstream/ui';
import { AppLoading, ViewEditCloneRecordWrapper } from '@jetstream/ui-core';
import '@jetstream/ui-styles/main.css';
import '@salesforce-ux/design-system-2/dist/css/bundled/slds2.cosmos.css';
import { Provider, useAtomValue } from 'jotai';
import { ReactNode, Suspense } from 'react';
import ModalContainer from 'react-modal-promise';
import { MemoryRouter } from 'react-router';
import { environment } from '../environments/environment';
import { browserExtensionAxiosAdapter } from '../utils/extension-axios-adapter';
import { chromeStorageLoading, extensionStateStore } from '../utils/extension.store';
import '../utils/monaco-loader';
import AppInitializer from './AppInitializer';
import { ExtensionThemeApplier } from './ExtensionThemeApplier';

// DO NOT CHANGE ORDER OF IMPORTS
// Brand theming: must load AFTER slds2.cosmos.css so the :root brand-ramp override wins (equal specificity → last wins)
import '@jetstream/ui-styles/brand-theme.css';
// DO NOT CHANGE ORDER OF IMPORTS

if (!environment.production) {
  enableLogger(true);
}

AxiosAdapterConfig.adapter = browserExtensionAxiosAdapter;

function AppWrapperInner({ allowWithoutSalesforceOrg, children }: { allowWithoutSalesforceOrg?: boolean; children: ReactNode }) {
  const isLoading = useAtomValue(chromeStorageLoading);
  if (isLoading) {
    return <AppLoading />;
  }
  return (
    <ConfirmationServiceProvider>
      <Suspense fallback={<AppLoading />}>
        <MemoryRouter>
          <AppInitializer allowWithoutSalesforceOrg={allowWithoutSalesforceOrg}>
            <ExtensionThemeApplier />
            <ModalContainer />
            <AppToast />
            <ViewEditCloneRecordWrapper />
            {children}
          </AppInitializer>
        </MemoryRouter>
      </Suspense>
    </ConfirmationServiceProvider>
  );
}

export function AppWrapper({ allowWithoutSalesforceOrg, children }: { allowWithoutSalesforceOrg?: boolean; children: ReactNode }) {
  return (
    <Provider store={extensionStateStore}>
      <AppWrapperInner allowWithoutSalesforceOrg={allowWithoutSalesforceOrg}>{children}</AppWrapperInner>
    </Provider>
  );
}
