import { format, startOfDay } from 'date-fns';
import { logger } from './config/logger.config';
import { deleteUser, searchUsersPaginateAll } from './utils/auth0';
import { deleteUserAndOrgs } from './utils/cron-utils';
import { accountDeletionInitialNotification } from './utils/slack';
import { DeleteResult } from './utils/types';

(async () => {
  /**
   * 1. Query Auth0 API to get all users where app_metadata.accountDeletionDate != null AND app_metadata.accountDeletionDate < today
   * 2. For each user, delete the user from Auth0
   * 3. Delete all orgs
   * 4. Mark as deleted in local DB
   * 5 Send slack notification with a summary of every user that was deleted
   */

  const accountDeletionDate = format(startOfDay(new Date()), 'yyyy-MM-dd');

  const params = {
    sort: 'email:1',
    fields: 'created_at,email,email_verified,name,updated_at,user_id,last_login,logins_count',
    include_fields: 'true',
    q: `(_exists_:app_metadata.accountDeletionDate AND app_metadata.accountDeletionDate:[* TO ${accountDeletionDate}])`,
  };

  logger.debug('[inactive-account-deletion][FETCHING USERS] %o', { accountDeletionDate, params }, { cronTask: true });

  const usersToDelete = await searchUsersPaginateAll(params);

  const results: DeleteResult[] = [];

  for (const user of usersToDelete) {
    const result: DeleteResult = {
      auth0Id: user.user_id,
      auth0Success: true,
      localDeleteSuccess: true,
      orgCount: null,
      localDatabaseId: null,
    };

    try {
      // delete from Auth0
      await deleteUser(user.user_id);
      logger.debug('[inactive-account-deletion][Deleted from Auth0] %o', { userId: user.user_id }, { cronTask: true });

      try {
        // delete locally
        const { orgCount, userId } = await deleteUserAndOrgs(user);
        result.orgCount = orgCount;
        result.localDatabaseId = userId;

        logger.debug(
          '[inactive-account-deletion][Marked as deleted locally] %o',
          { userId: user.user_id, orgCount, localDatabaseId: userId },
          { cronTask: true }
        );
      } catch (ex) {
        // failed to mark as deleted locally
        result.localDeleteSuccess = false;
      }
    } catch (ex) {
      // failed to delete from auth0
      result.auth0Success = false;
    }
    results.push(result);
  }

  // Slack message
  try {
    await accountDeletionInitialNotification(results);
    logger.debug('[inactive-account-deletion][Slack messages sent successfully] %o', { cronTask: true });
  } catch (ex) {
    logger.debug('[inactive-account-deletion][Slack messages error] %o', { cronTask: true });
  }
})();
