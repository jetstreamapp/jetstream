export const environment = {
  name: 'Jetstream',
  production: true,
  isElectron: true,
  rollbarClientAccessToken: import.meta.env.NX_ROLLBAR_KEY,
  amplitudeToken: import.meta.env.NX_AMPLITUDE_KEY,
  authAudience: import.meta.env.NX_AUTH_AUDIENCE,
  MODE: import.meta.env.MODE,
  BASE_URL: import.meta.env.BASE_URL,
  PROD: import.meta.env.PROD,
  DEV: import.meta.env.DEV,
  SSR: import.meta.env.SSR,
};
