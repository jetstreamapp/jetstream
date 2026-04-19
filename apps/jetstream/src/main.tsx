/* eslint-disable no-restricted-globals */
// DO NOT CHANGE ORDER OF IMPORTS
import { CONFIG } from './app/components/core/config';
// DO NOT CHANGE ORDER OF IMPORTS

import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import '@salesforce-ux/design-system/assets/styles/salesforce-lightning-design-system.css';
import { createRoot } from 'react-dom/client';
import App from './app/app';
import './main.scss';

// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
const container = document.getElementById('root')!;
const cspNonce = document.querySelector<HTMLScriptElement>('script[nonce]')?.nonce;
const emotionCache = createCache({ key: 'css', nonce: cspNonce && cspNonce !== '__CSP_NONCE__' ? cspNonce : undefined });

if (location.hostname === 'localhost' && !location.pathname.includes('/app')) {
  location.href = '/app';
}

createRoot(container).render(
  <CacheProvider value={emotionCache}>
    <div className="app">
      <CONFIG.Router basename={CONFIG.baseName}>
        <App />
      </CONFIG.Router>
    </div>
  </CacheProvider>,
);
