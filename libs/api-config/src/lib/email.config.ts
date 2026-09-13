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
    await logEmailActivity({ email: to, subject, status: `unsent` });
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

  await logEmailActivity({ email: to, subject, status: `${results.status}` || null, providerId: results.id });
}

/**
 * Records the send in `email_activity`.
 *
 * Awaited rather than fire-and-forget: every cron task calls `process.exit` as soon as its work
 * resolves, which drops an in-flight insert and leaves no local record that the mail went out. The
 * Cloudflare WAF spike detector additionally reads this table to enforce its alert cooldown, so a
 * lost row makes it re-alert on the same window.
 *
 * Failures are logged and swallowed so that logging can never break delivery of an email that Mailgun
 * has already accepted.
 */
async function logEmailActivity(data: { email: string; subject: string; status: string | null; providerId?: string }) {
  await prisma.emailActivity
    .create({ data, select: { id: true } })
    .catch((err) => logger.error({ message: err?.message }, '[EMAIL][ERROR] Error logging email activity'));
}
