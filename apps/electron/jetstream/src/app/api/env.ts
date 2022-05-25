import { environment } from '../../environments/environment';

export const ENV = {
  SFDC_CLIENT_ID: environment.SFDC_CLIENT_ID,
  ROLLBAR_TOKEN: environment.rollbarClientAccessToken,
};
