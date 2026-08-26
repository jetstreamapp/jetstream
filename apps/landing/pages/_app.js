// Must stay the first import — Zod probes for eval support when the first schema is constructed,
// which happens while these imports are evaluated. See configure-zod.
import '@jetstream/shared/utils/configure-zod';

import { CookieConsentBanner, useConditionalGoogleAnalytics } from '@jetstream/ui/cookie-consent-banner';
import Layout from '../components/layouts/Layout';
import './index.css';

export default function MyApp({ Component, pageProps }) {
  useConditionalGoogleAnalytics(process.env.NX_GOOGLE_ANALYTICS_KEY || '');
  // Use page layout or fallback to default inverse layout
  const getLayout = Component.getLayout ?? ((page) => <Layout isInverse>{page}</Layout>);

  return getLayout(
    <>
      <Component {...pageProps} />
      <div className="no-print">
        <CookieConsentBanner
          /* Placeholder to ensure that no page content gets hidden behind the banner */
          containerStyles={{ minHeight: '80px' }}
        />
      </div>
    </>,
  );
}
