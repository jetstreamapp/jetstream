import Mailgun from 'mailgun.js';
import formData from 'form-data';
import { ENV } from './env-config';

export let mailgun: any;

if (ENV.MAILGUN_API_KEY) {
  mailgun = new Mailgun(formData).client({
    username: 'api',
    key: ENV.MAILGUN_API_KEY,
    public_key: ENV.MAILGUN_PUBLIC_KEY,
  });
}
