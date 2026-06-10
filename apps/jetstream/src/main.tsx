/* eslint-disable no-restricted-globals */
// DO NOT CHANGE ORDER OF IMPORTS
import { CONFIG } from './app/components/core/config';
// DO NOT CHANGE ORDER OF IMPORTS

import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import { applyThemeBeforeMount } from '@jetstream/ui-core';
import '@jetstream/ui-styles/main.css';
import '@salesforce-ux/design-system-2/dist/css/bundled/slds2.cosmos.css';
import { createRoot } from 'react-dom/client';
import App from './app/app';

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const container = document.getElementById('root')!;
const cspNonce = document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce;
const emotionCache = createCache({ key: 'css', nonce: cspNonce && cspNonce !== '__CSP_NONCE__' ? cspNonce : undefined });

if (location.hostname === 'localhost' && !location.pathname.includes('/app')) {
  location.href = '/app';
}

applyThemeBeforeMount().finally(() => {
  createRoot(container).render(
    <CacheProvider value={emotionCache}>
      <div className="app">
        <CONFIG.Router basename={CONFIG.baseName}>
          <App />
        </CONFIG.Router>
      </div>
    </CacheProvider>,
  );
});
