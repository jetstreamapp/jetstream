// UNUSED: `fileReplacements` are not applied by the @nx/vite build, so `environment.ts` ships in
// every build. Keep this in sync, but do not rely on it — see the note in `environment.ts`.
export const environment = {
  production: true,
  serverUrl: 'https://staging.jetstream-app.com',
  sentryDsn: import.meta.env.NX_PUBLIC_SENTRY_DSN_CANVAS,
  amplitudeToken: null,
  isWebExtension: false,
};
