import { ClerkProvider } from '@clerk/clerk-react';
import './index.scss';

// This default export is required in a new `pages/_app.js` file.
export default function MyApp({ Component, pageProps }) {
  return (
    <ClerkProvider
      publishableKey={process.env.NX_PUBLIC_CLERK_PUBLISHABLE_KEY}
      afterMultiSessionSingleSignOutUrl="/"
      afterSignOutUrl="/"
      allowedRedirectOrigins={[process.env.NX_PUBLIC_LANDING_PAGE_URL, process.env.NX_PUBLIC_CLIENT_URL]}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      signInForceRedirectUrl={`${process.env.NX_PUBLIC_CLIENT_URL}/app`}
      signInFallbackRedirectUrl={`${process.env.NX_PUBLIC_CLIENT_URL}/app`}
      signUpForceRedirectUrl={`${process.env.NX_PUBLIC_CLIENT_URL}/app`}
      signUpFallbackRedirectUrl={`${process.env.NX_PUBLIC_CLIENT_URL}/app`}
      supportEmail="support@getjetstream.app"
      appearance={{
        layout: {
          helpPageUrl: 'https://docs.getjetstream.app/',
          privacyPageUrl: 'https://getjetstream.app/privacy',
          termsPageUrl: 'https://getjetstream.app/terms',
        },
      }}
      {...pageProps}
    >
      <Component {...pageProps} />
    </ClerkProvider>
  );
}
