// UNUSED: `fileReplacements` are not applied by the @nx/vite build, so `environment.ts` ships in
// every build. Keep this in sync, but do not rely on it — see the note in `environment.ts`.
export const environment = {
  name: 'Jetstream',
  production: true,
  sentryDsn: import.meta.env.NX_PUBLIC_SENTRY_DSN_DESKTOP,
  // FIXME: we do want this in
  amplitudeToken: null,
  STRIPE_PUBLIC_KEY: null,
  BILLING_ENABLED: false,
  isWebExtension: false,
};
