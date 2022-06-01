import { environment } from '../../environments/environment';

export const ENV = {
  ROLLBAR_TOKEN: environment.rollbarClientAccessToken,
  SFDC_CLIENT_ID: environment.SFDC_CLIENT_ID,
  SFDC_FALLBACK_API_VERSION: '54.0',
};
