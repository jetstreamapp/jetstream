import { ENV } from '../app/config/env-config';

export const environment = {
  production: ENV.NODE_ENV === 'production',
};
