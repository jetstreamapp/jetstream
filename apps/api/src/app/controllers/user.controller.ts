import { getExceptionLog, mailgun } from '@jetstream/api-config';
import { UserFacingError } from '../utils/error-handler';
import { sendJson } from '../utils/response.handlers';
import { createRoute } from '../utils/route.utils';

export const routeDefinition = {
  emailSupport: {
    controllerFn: () => emailSupport,
    validators: {
      hasSourceOrg: false,
    },
  },
};

const emailSupport = createRoute(routeDefinition.emailSupport.validators, async ({ body, userId }, req, res, next) => {
  const files = Array.isArray(req.files) ? req.files : [];
  const { emailBody } = body || {};

  try {
    const results = await mailgun.messages.create('mail.getjetstream.app', {
      from: 'Jetstream Support <support@getjetstream.app>',
      to: 'support@getjetstream.app',
      subject: 'Jetstream - User submitted feedback',
      template: 'generic_notification',
      attachment: files?.map((file) => ({ data: file.buffer, filename: file.originalname })),
      'h:X-Mailgun-Variables': JSON.stringify({
        title: 'User submitted feedback',
        previewText: 'User submitted feedback',
        headline: `User submitted feedback`,
        bodySegments: [
          {
            text: emailBody,
          },
          {
            text: `The account ${userId} has submitted feedback.`,
          },
        ],
      }),
      'h:Reply-To': 'support@getjetstream.app',
    });
    req.log.info('[SUPPORT EMAIL][EMAIL SENT] %s', results.id);
    sendJson(res);
  } catch (ex) {
    req.log.error(getExceptionLog(ex), '[SUPPORT EMAIL][ERROR] %s', ex.message || 'An unknown error has occurred.');
    throw new UserFacingError('There was a problem sending the email');
  }
});
