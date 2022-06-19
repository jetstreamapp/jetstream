declare const __BUILD_VERSION__: string;

export const environment = {
  production: false,
  rollbarClientAccessToken: process.env.NX_ROLLBAR_KEY,
  SFDC_CLIENT_ID: process.env.NX_SFDC_CLIENT_ID_ELECTRON,
  sfdcFallbackApiVersion: process.env.NX_SFDC_FALLBACK_API_VERSION,
  version: __BUILD_VERSION__,
};
