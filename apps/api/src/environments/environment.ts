import { ENV } from '@jetstream/api-config';

export const environment = {
  production: ENV.NODE_ENV === 'production',
};
