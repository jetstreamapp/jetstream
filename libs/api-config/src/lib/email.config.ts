import Mailgun from 'mailgun.js';
import { prisma } from './api-db-config';
import { logger } from './api-logger';
import { ENV } from './env-config';

let mailgun: ReturnType<Mailgun['client']>;

type CustomFileData = string | Blob | File | Buffer | NodeJS.ReadableStream;
type CustomFile = {
  data: CustomFileData;
  filename?: string;
  contentType?: string;
  knownLength?: number;
  [key: string]: unknown;
};
type MessageAttachment = CustomFile | CustomFile[] | File | File[] | string | CustomFileData | CustomFileData[];

if (ENV.MAILGUN_API_KEY) {
  mailgun = new Mailgun(FormData).client({
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
  attachment?: MessageAttachment;
  html: string;
  text: string;
  [key: string]: unknown;
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

  prisma.emailActivity
    .create({
      data: { email: to, subject, status: `${results.status}` || null, providerId: results.id },
      select: { id: true },
    })
    .catch((err) => logger.error({ message: err?.message }, '[EMAIL][ERROR] Error logging email activity'));
}
