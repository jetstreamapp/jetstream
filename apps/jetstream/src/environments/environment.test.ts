export const environment = {
  name: 'JetstreamTest',
  production: true,
  rollbarClientAccessToken: process.env.NX_PUBLIC_ROLLBAR_KEY,
  amplitudeToken: process.env.NX_PUBLIC_AMPLITUDE_KEY,
  authAudience: process.env.NX_PUBLIC_AUTH_AUDIENCE,
  // MODE: import.meta.env.MODE,
  // BASE_URL: import.meta.env.BASE_URL,
  // PROD: import.meta.env.PROD,
  // DEV: import.meta.env.DEV,
  // SSR: import.meta.env.SSR,
};
