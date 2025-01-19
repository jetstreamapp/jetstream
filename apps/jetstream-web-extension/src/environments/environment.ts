// This file can be replaced during build by using the `fileReplacements` array.
// When building for production, this file is replaced with `environment.prod.ts`.

export const environment = {
  production: false,
  serverUrl: 'http://localhost:3333',
  rollbarClientAccessToken: process.env.NX_PUBLIC_ROLLBAR_KEY,
  amplitudeToken: process.env.NX_PUBLIC_AMPLITUDE_KEY,
  isWebExtension: true,
};
