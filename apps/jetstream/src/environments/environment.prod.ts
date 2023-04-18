export const environment = {
  name: 'Jetstream',
  production: true,
  isElectron: false,
  rollbarClientAccessToken: import.meta.env.NX_ROLLBAR_KEY,
  amplitudeToken: import.meta.env.NX_AMPLITUDE_KEY,
  authAudience: import.meta.env.NX_AUTH_AUDIENCE,
};
