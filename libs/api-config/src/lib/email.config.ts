import formData from 'form-data';
import Mailgun from 'mailgun.js';
import { prisma } from './api-db-config';
import { logger } from './api-logger';
import { ENV } from './env-config';

let mailgun: ReturnType<Mailgun['client']>;

if (ENV.MAILGUN_API_KEY) {
  mailgun = new Mailgun(formData).client({
    username: 'api',
    key: ENV.MAILGUN_API_KEY,
  });
}

export async function sendEmail({
  from,
  replyTo,
  to,
  subject,
  attachment,
  html,
  text,
  ...rest
}: {
  from?: string;
  replyTo?: string;
  to: string;
  subject: string;
  attachment?: any;
  html: string;
  text: string;
  [key: string]: any;
}) {
  if (!mailgun) {
    logger.warn('[EMAIL][ERROR] Mail client not configured, skipping sending email');
    prisma.emailActivity
      .create({
        data: { email: to, subject, status: `unsent` },
        select: { id: true },
      })
      .catch((err) => logger.error({ message: err?.message }, '[EMAIL][ERROR] Error logging email activity'));
    return;
  }

  const results = await mailgun.messages.create(ENV.JETSTREAM_EMAIL_DOMAIN, {
    from: from || ENV.JETSTREAM_EMAIL_FROM_NAME,
    'h:Reply-To': replyTo || ENV.JETSTREAM_EMAIL_REPLY_TO,
    to,
    subject,
    text,
    html,
    attachment,
    ...rest,
  });

  if (results.id) {
    prisma.emailActivity
      .create({
        data: { email: to, subject, status: `${results.status || ''}`, providerId: results.id },
        select: { id: true },
      })
      .catch((err) => logger.error({ message: err?.message }, '[EMAIL][ERROR] Error logging email activity'));
  }
}
