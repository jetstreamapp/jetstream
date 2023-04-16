import formData from 'form-data';
import Mailgun from 'mailgun.js';
import { ENV } from './env-config';

export let mailgun: ReturnType<Mailgun['client']>;

if (ENV.MAILGUN_API_KEY) {
  mailgun = new Mailgun(formData).client({
    username: 'api',
    key: ENV.MAILGUN_API_KEY,
    public_key: ENV.MAILGUN_PUBLIC_KEY,
  });
}
