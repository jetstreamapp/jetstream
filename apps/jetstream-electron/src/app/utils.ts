import Rollbar from 'rollbar';
import { environment } from '../environments/environment';

export let rollbar: Rollbar;

export function initRollbar() {
  rollbar = Rollbar.init({
    accessToken: environment.rollbarClientAccessToken,
    environment: environment.production ? 'development' : 'production',
    captureUncaught: true,
    captureUnhandledRejections: true,
    payload: {
      platform: 'client',
      code_version: environment.version,
    },
  });
}
