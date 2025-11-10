import { CookieConsentBanner, useConditionalGoogleAnalytics } from '@jetstream/ui/cookie-consent-banner';
import Layout from '../components/layouts/Layout';
import './index.scss';

export default function MyApp({ Component, pageProps }) {
  useConditionalGoogleAnalytics(process.env.NX_GOOGLE_ANALYTICS_KEY || '');
  // Use page layout or fallback to default inverse layout
  const getLayout = Component.getLayout ?? ((page) => <Layout isInverse>{page}</Layout>);

  return getLayout(
    <>
      <Component {...pageProps} />
      <CookieConsentBanner
        /* Placeholder to ensure that no page content gets hidden behind the banner */
        containerStyles={{ minHeight: '80px' }}
      />
    </>,
  );
}
