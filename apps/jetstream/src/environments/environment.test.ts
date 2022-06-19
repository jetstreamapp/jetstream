export const environment = {
  name: 'JetstreamTest',
  production: true,
  isElectron: false,
  rollbarClientAccessToken: process.env.NX_ROLLBAR_KEY,
  amplitudeToken: process.env.NX_AMPLITUDE_KEY,
  authAudience: process.env.NX_AUTH_AUDIENCE,
  VERSION: process.env.GIT_VERSION,
  SHA: process.env.GIT_SHA,
  BRANCH: process.env.GIT_BRANCH,
};
