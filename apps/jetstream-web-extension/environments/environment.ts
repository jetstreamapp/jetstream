// This file can be replaced during build by using the `fileReplacements` array.
// When building for production, this file is replaced with `environment.prod.ts`.

export const environment = {
  name: 'JetstreamDev',
  production: false,
  rollbarClientAccessToken: process.env.NX_PUBLIC_ROLLBAR_KEY,
  amplitudeToken: process.env.NX_PUBLIC_AMPLITUDE_KEY,
  authAudience: process.env.NX_PUBLIC_AUTH_AUDIENCE,
  MODE: process.env.MODE,
  BASE_URL: process.env.BASE_URL,
  PROD: process.env.PROD,
  DEV: process.env.DEV,
  SSR: process.env.SSR,
};
