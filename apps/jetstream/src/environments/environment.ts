// This file can be replaced during build by using the `fileReplacements` array.
// When building for production, this file is replaced with `environment.prod.ts`.

export const environment = {
  name: 'JetstreamDev',
  production: false,
  isElectron: false,
  rollbarClientAccessToken: 'd4b6a70b70444f91bdc22b2818040c7f',
  amplitudeToken: '242998ee09e81f804ae1536d9fd1429b',
  VERSION: process.env.GIT_VERSION,
  SHA: process.env.GIT_SHA,
  BRANCH: process.env.GIT_BRANCH,
};
