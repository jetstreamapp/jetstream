import { getExceptionLog } from '@jetstream/api-config';
import { addMonths, endOfDay, format, startOfMonth } from 'date-fns';
import { mailgun } from './config/email.config';
import { logger } from './config/logger.config';
import { searchUsersPaginateAll, updateUser } from './utils/auth0';
import { logExceptionToSlack, sendInactiveUserWarning } from './utils/slack';
// import * as userDb from '../db/user.db';

/**
 *
 * Search Auth0 for all users that have not logged in in past {@code(NUM_MONTHS)} months
 *
 */
const INACTIVE_MONTHS = 6;
const MONTHS_UNTIL_DELETE = 1;

(async () => {
  const lastLoginDateCutoff = format(startOfMonth(addMonths(new Date(), INACTIVE_MONTHS * -1)), 'yyyy-MM-dd');
  const accountDeletionDate = format(endOfDay(addMonths(new Date(), MONTHS_UNTIL_DELETE)), 'yyyy-MM-dd');
  const params = {
    sort: 'last_login:1',
    fields: 'created_at,email,email_verified,name,updated_at,user_id,last_login,logins_count',
    include_fields: 'true',
    q: `(NOT _exists_:last_login OR last_login:[* TO ${lastLoginDateCutoff}]) AND NOT _exists_:app_metadata.accountDeletionDate`,
  };

  logger.debug({ lastLoginDateCutoff, accountDeletionDate, params }, '[inactive-account-warning][FETCHING USERS]');

  /**
   * GET USERS TO DELETE
   */
  const usersToNotify = await searchUsersPaginateAll(params);
  let failedCount = 0;
  let successEmailCount = 0;
  let successAuth0UpdateCount = 0;

  logger.debug({ usersToNotifyLength: usersToNotify.length }, '[inactive-account-warning][FOUND USERS]');

  for (const user of usersToNotify) {
    /**
     * Send Email to Users
     */
    try {
      logger.debug({ userId: user.user_id, email: user.email }, '[inactive-account-warning][SENDING EMAIL]');
      // https://documentation.mailgun.com/en/latest/api-sending.html#sending
      await mailgun.messages.create('mail.getjetstream.app', {
        from: 'Jetstream Support <support@getjetstream.app>',
        to: `${user.email}`,
        subject: 'Jetstream - Account deletion warning',
        template: 'generic_notification',
        'h:X-Mailgun-Variables': JSON.stringify({
          title: 'Jetstream account deletion warning',
          previewText: 'Your Jetstream account will be deleted',
          headline: `We haven't seen you login to Jetstream recently.`,
          bodySegments: [
            {
              text: 'If you do not login to Jetstream in the next 30 days, your account and all of your data will be deleted. If you want to continue using Jetstream, login to your account within the next 30 days.',
            },
            {
              text: 'If you have been actively using Jetstream, you may have more than one account with the same email address. If you signed up using your email and password and later signed in using Google or Salesforce without combining accounts, you may have two separate accounts in which case your unused account will be deleted and you can disregard this email.',
            },
          ],
          // cta: {} // if this had a link to do something, it would be here (maybe a login now link?)
        }),
        'h:Reply-To': 'support@getjetstream.app',
        // ['o:tracking']: '',
      });

      successEmailCount += 1;

      /**
       * Update user on Auth0 - app_metadata.accountDeletionDate
       */
      try {
        await updateUser(user.user_id, { app_metadata: { accountDeletionDate } });

        successAuth0UpdateCount += 1;

        logger.debug({ userId: user.user_id, email: user.email, accountDeletionDate }, '[inactive-account-warning][USER UPDATED]');
      } catch (ex) {
        failedCount += 1;
        // failed to update auth0
        logger.error({ ...getExceptionLog(ex), userId: user.user_id }, '[inactive-account-warning][AUTH0 UPDATE][ERROR]');
        logExceptionToSlack('[inactive-account-warning][AUTH0 UPDATE][ERROR]', {
          userId: user.user_id,
          message: ex.message,
          stack: ex.stack,
        });
      }
    } catch (ex) {
      failedCount += 1;
      logger.error(
        '[inactive-account-warning][EMAIL][ERROR] %o',
        { message: ex.message, stack: ex.stack },
        { cronTask: true, userId: user.user_id }
      );
      logExceptionToSlack('[inactive-account-warning][EMAIL][ERROR]', { userId: user.user_id, message: ex.message, stack: ex.stack });
    }
  }

  /**
   * Send Slack Notification if any users were notified
   */
  if (usersToNotify.length) {
    await sendInactiveUserWarning(usersToNotify.length, { successEmailCount, successAuth0UpdateCount, failedCount });
  }
})();
