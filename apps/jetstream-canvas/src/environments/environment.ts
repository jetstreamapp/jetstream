// NOTE: `fileReplacements` are NOT applied by the @nx/vite build, so THIS file ships in every build
// and `environment.prod.ts` / `environment.staging.ts` are currently inert. Anything that has to be
// correct per build must therefore be derived from `import.meta.env`, which Vite resolves per mode.
//
// `serverUrl` deliberately keeps the value production has always shipped: canvas serves every API
// call from its own in-page router (`src/controllers/canvas.routes.ts`), so nothing dials this
// origin, and changing it now would change what already ships.

export const environment = {
  production: import.meta.env.PROD,
  serverUrl: 'http://localhost:3333',
  sentryDsn: import.meta.env.NX_PUBLIC_SENTRY_DSN_CANVAS,
  amplitudeToken: null,
  isWebExtension: false,
};
