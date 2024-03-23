import Rollbar from 'rollbar';
import { ENV } from './env-config';

export const rollbarServer = new Rollbar({
  codeVersion: ENV.GIT_VERSION,
  code_version: ENV.GIT_VERSION,
  accessToken: ENV.ROLLBAR_SERVER_TOKEN,
  environment: ENV.ENVIRONMENT,
  captureUncaught: true,
  captureUnhandledRejections: true,
  enabled: !!ENV.ROLLBAR_SERVER_TOKEN && ENV.ENVIRONMENT !== 'development',
  nodeSourceMaps: true,
});
