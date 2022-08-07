declare const __BUILD_VERSION__: string;

export const environment = {
  production: true,
  rollbarClientAccessToken: process.env.NX_ROLLBAR_KEY,
  SFDC_CLIENT_ID: process.env.NX_SFDC_CLIENT_ID_ELECTRON,
  version: __BUILD_VERSION__,
};
