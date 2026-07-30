// NOTE: `fileReplacements` are NOT applied by the @nx/vite build, so THIS file ships in every build
// and `environment.prod.ts` is currently inert. Anything that has to be correct per build must be
// derived from `import.meta.env`, which Vite resolves per mode.
//
// `name` deliberately keeps the `JetstreamDev` value production has always shipped — it names the
// local database, so correcting it would strand existing user data.

export const environment = {
  name: 'JetstreamDev',
  production: import.meta.env.PROD,
  sentryDsn: import.meta.env.NX_PUBLIC_SENTRY_DSN_DESKTOP,
  // FIXME: we do want this in
  amplitudeToken: undefined,
  STRIPE_PUBLIC_KEY: '',
  BILLING_ENABLED: false,
  isWebExtension: false,
};
