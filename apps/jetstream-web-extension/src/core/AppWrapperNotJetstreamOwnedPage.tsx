/* eslint-disable no-restricted-globals */
import { enableLogger } from '@jetstream/shared/client-logger';
import '@salesforce-ux/design-system/assets/styles/salesforce-lightning-design-system.min.css';
import localforage from 'localforage';
import { ReactNode, Suspense, useEffect, useState } from 'react';
import { RecoilRoot } from 'recoil';
import RecoilNexus from 'recoil-nexus';
import { environment } from '../environments/environment';
import '../main.scss';
import { LOCAL_DRIVER_NAME, localDriver } from '../utils/web-extension-localforage-driver';

if (!environment.production) {
  enableLogger(true);
}

/**
 * This is used for any code that runs on a page that is not owned by Jetstream
 * OR where we do not need to initialize the entire normal app state (e.x. our settings page)
 *
 * This should NEVER be used for core jetstream since we would not want all the cached data to ever be stored in chrome storage
 * AND we would run out of storage space
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
          name: 'jetstream-web-ext-no-sync',
          driver: LOCAL_DRIVER_NAME,
        });
        setHasInit(true);
      })
      .catch((err) => {
        localforage.config({
          name: 'jetstream-web-ext-no-sync',
        });
        setHasInit(true);
      });
  });

  if (!hasInit) {
    return null;
  }

  return (
    <RecoilRoot>
      <RecoilNexus />
      <Suspense fallback={'Loading...'}>{children}</Suspense>
    </RecoilRoot>
  );
}
