import { addMonths, endOfDay, format, startOfMonth } from 'date-fns';
import { mailgun } from './config/email.config';
import { logger } from './config/logger.config';
import { searchUsersPaginateAll, updateUser } from './utils/auth0';
import { getTemplate, TEXT_EMAIL_CONTENT } from './utils/email-templates';
import { sendInactiveUserWarning } from './utils/slack';
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

  logger.debug('[inactive-account-warning][FETCHING USERS] %o', { lastLoginDateCutoff, accountDeletionDate, params }, { cronTask: true });

  /**
   * GET USERS TO DELETE
   */
  const usersToNotify = await searchUsersPaginateAll(params);

  logger.debug('[inactive-account-warning][FOUND USERS] %o', { usersToNotifyLength: usersToNotify.length }, { cronTask: true });

  for (const user of usersToNotify) {
    /**
     * Send Email to Users
     */
    try {
      logger.debug(
        '[inactive-account-warning][SENDING EMAIL] %o',
        { userId: user.user_id, email: user.email },
        { cronTask: true, userId: user.user_id }
      );
      // https://documentation.mailgun.com/en/latest/api-sending.html#sending
      await mailgun.messages.create('mail.getjetstream.app', {
        from: 'Jetstream Support <support@getjetstream.app>',
        to: `${user.email}`,
        subject: 'Jetstream - Account deletion warning',
        html: getTemplate('Jetstream account deletion warning', 'Your Jetstream account will be deleted', 'ACCOUNT_DEACTIVATION_WARNING'),
        text: TEXT_EMAIL_CONTENT.ACCOUNT_DEACTIVATION_WARNING,
        'h:Reply-To': 'support@getjetstream.app',
        // ['o:tracking']: '',
      });

      /**
       * Update user on Auth0 - app_metadata.accountDeletionDate
       */
      try {
        await updateUser(user.user_id, { app_metadata: { accountDeletionDate } });

        logger.debug(
          '[inactive-account-warning][USER UPDATED] %o',
          { userId: user.user_id, email: user.email, accountDeletionDate },
          { cronTask: true, userId: user.user_id }
        );
      } catch (ex) {
        // failed to update auth0
        logger.error(
          '[inactive-account-warning][AUTH0 UPDATE][ERROR] %o',
          { message: ex.message, stack: ex.stack },
          { cronTask: true, userId: user.user_id }
        );
      }
    } catch (ex) {
      logger.error(
        '[inactive-account-warning][EMAIL][ERROR] %o',
        { message: ex.message, stack: ex.stack },
        { cronTask: true, userId: user.user_id }
      );
    }
  }

  /**
   * Send Slack Notification if any users were notified
   */
  if (usersToNotify.length) {
    await sendInactiveUserWarning(usersToNotify.length);
  }
})();
