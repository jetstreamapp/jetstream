import { useConditionalGoogleAnalytics } from '@jetstream/ui/cookie-consent-banner';
import { Head, Html, Main, NextScript } from 'next/document';

export default function Document() {
  useConditionalGoogleAnalytics(process.env.NX_GOOGLE_ANALYTICS_KEY || '');
  return (
    <Html>
      <Head />
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
