// This file can be replaced during build by using the `fileReplacements` array.
// When building for production, this file is replaced with `environment.prod.ts`.

export const environment = {
  name: 'JetstreamDev',
  production: false,
  isElectron: false,
  rollbarClientAccessToken: process.env.NX_ROLLBAR_KEY,
  amplitudeToken: process.env.NX_AMPLITUDE_KEY,
  authAudience: process.env.NX_AUTH_AUDIENCE,
  agGridKey: process.env.NX_AG_GRID_KEY,
  VERSION: process.env.GIT_VERSION,
  SHA: process.env.GIT_SHA,
  BRANCH: process.env.GIT_BRANCH,
};
