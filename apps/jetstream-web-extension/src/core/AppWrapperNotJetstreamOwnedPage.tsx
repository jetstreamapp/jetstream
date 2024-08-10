/* eslint-disable no-restricted-globals */
import { enableLogger } from '@jetstream/shared/client-logger';
import { ConfirmationServiceProvider } from '@jetstream/ui';
import { AppLoading } from '@jetstream/ui-core';
import { LOCAL_DRIVER_NAME, localDriver } from '@jetstream/web-extension-utils';
import '@salesforce-ux/design-system/assets/styles/salesforce-lightning-design-system.min.css';
import localforage from 'localforage';
import { ReactNode, Suspense, useEffect, useState } from 'react';
import { RecoilRoot } from 'recoil';
import '../main.scss';

enableLogger(true);

/**
 * This is used for any code that runs on a page that is not owned by Jetstream
 * OR where we do not need to initialize the entire normal app state (e.x. our settings page)
 *
 * This should NEVER be used for core jetstream since we would not want all the cached data to ever be stored in chrome storage
 *
 * we use chrome storage to store data
 */
export function AppWrapperNotJetstreamOwnedPage({ children }: { children: ReactNode }) {
  const [hasInit, setHasInit] = useState(false);

  useEffect(() => {
    localforage
      .defineDriver(localDriver as any)
      .then(() => {
        localforage.setDriver(LOCAL_DRIVER_NAME);
        localforage.config({
          name: 'jetstream-web-extension',
          driver: LOCAL_DRIVER_NAME,
        });
        setHasInit(true);
      })
      .catch((err) => {
        localforage.config({
          name: 'jetstream-web-extension',
        });
        setHasInit(true);
      });
  });

  if (!hasInit) {
    return null;
  }

  return (
    <ConfirmationServiceProvider>
      <RecoilRoot>
        <Suspense fallback={<AppLoading />}>
          {/* <AppInitializer
            onUserProfile={() => {
              // TODO:
            }}
          > */}
          {/* <OverlayProvider> */}
          {/* <DndProvider backend={HTML5Backend}> */}
          {/* <ModalContainer /> */}
          {/* <AppStateResetOnOrgChange /> */}
          {/* <AppToast /> */}
          {/* <LogInitializer /> */}
          {/* <NotificationsRequestModal loadDelay={10000} featureFlags={featureFlags} /> */}
          {/* <DownloadFileStream /> */}
          {children}
          {/* </DndProvider> */}
          {/* </OverlayProvider> */}
          {/* </AppInitializer> */}
        </Suspense>
      </RecoilRoot>
    </ConfirmationServiceProvider>
  );
}
