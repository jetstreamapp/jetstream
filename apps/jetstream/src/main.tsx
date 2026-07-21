/* eslint-disable no-restricted-globals */
// DO NOT CHANGE ORDER OF IMPORTS
import { CONFIG } from './app/components/core/config';
// DO NOT CHANGE ORDER OF IMPORTS

// Register the vite:preloadError listener before App is imported so it is active
// before any dynamic import (routes, monaco) can fail on a stale deploy
import './app/components/core/preload-error-recovery';

import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
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
