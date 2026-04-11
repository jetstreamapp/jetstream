export const environment = {
  production: true,
  serverUrl: 'https://staging.jetstream-app.com',
  rollbarClientAccessToken: import.meta.env.NX_PUBLIC_ROLLBAR_KEY,
  amplitudeToken: import.meta.env.NX_PUBLIC_AMPLITUDE_KEY,
  isWebExtension: true,
};
