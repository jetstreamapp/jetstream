import type { Job } from 'pg-boss';
import type { EmailJob, EmailType } from '@jetstream/types';
import { logger } from '../config/logger.config';
import { mailgun } from '../config/email.config';

export const EMAIL_JOB_TYPE = 'EMAIL';

export const EMAIL_TYPES: EmailType[] = ['WELCOME'];

const handler = async (job: Job<EmailJob>) => {
  const { type, email, userId } = job.data;
  logger.debug('[JOB STARTED] %s', type, { jobId: job.id, userId });

  switch (type) {
    case 'WELCOME':
      try {
        // https://documentation.mailgun.com/en/latest/api-sending.html#sending
        await mailgun.messages.create('mail.getjetstream.app', {
          from: 'Jetstream Support <support@getjetstream.app>',
          to: `${email}`,
          subject: 'Welcome to Jetstream!',
          html: '<html><body>TEST</body></html>',
          text: 'TEST',
          'h:Reply-To': 'support@getjetstream.app',
          // ['o:tracking']: '',
        });
      } catch (ex) {
        // TODO:
        logger.error('[JOB][ERROR] %o', ex, { jobId: job.id, userId });
      }
      break;

    default:
      break;
  }
};

export default handler;
