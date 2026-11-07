/* eslint-disable no-restricted-globals */
// DO NOT CHANGE ORDER OF IMPORTS
import { CONFIG } from './app/components/core/config';
// DO NOT CHANGE ORDER OF IMPORTS

import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import { addNonceToCreatedStyleElements } from '@jetstream/shared/ui-utils';
import { applyThemeBeforeMount } from '@jetstream/ui-core';
import '@jetstream/ui-styles/main.css';
import '@salesforce-ux/design-system-2/dist/css/bundled/slds2.cosmos.css';
import { createRoot } from 'react-dom/client';
import App from './app/app';

// DO NOT CHANGE ORDER OF IMPORTS
// Brand POC: must load AFTER slds2.cosmos.css so the :root brand-ramp override wins (equal specificity → last wins)
import '@jetstream/ui-styles/brand-theme.css';
// DO NOT CHANGE ORDER OF IMPORTS

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const container = document.getElementById('root')!;
const scriptNonce = document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce;
// The placeholder is only replaced when the server sends index.html, not under the Vite dev server
const cspNonce = scriptNonce && scriptNonce !== '__CSP_NONCE__' ? scriptNonce : undefined;
if (cspNonce) {
  addNonceToCreatedStyleElements(cspNonce);
}
const emotionCache = createCache({ key: 'css', nonce: cspNonce });

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
