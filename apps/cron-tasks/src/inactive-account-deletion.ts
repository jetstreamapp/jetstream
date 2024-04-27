import { endOfDay, format, isBefore, parseISO, startOfDay } from 'date-fns';
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
    fields: 'created_at,email,email_verified,name,updated_at,user_id,last_login,logins_count,app_metadata',
    include_fields: 'true',
    // Range filters are not allowed for app_metadata, so we are filtering results after
    q: `_exists_:app_metadata.accountDeletionDate`,
  };

  logger.debug({ accountDeletionDate, params }, '[inactive-account-deletion][FETCHING USERS]');

  const cutoff = endOfDay(new Date());
  const usersToDelete = (await searchUsersPaginateAll(params)).filter((user) => {
    try {
      if (!user.app_metadata.accountDeletionDate) {
        return false;
      }
      return isBefore(parseISO(user.app_metadata.accountDeletionDate), cutoff);
    } catch (ex) {
      return false;
    }
  });

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
      logger.debug({ userId: user.user_id }, '[inactive-account-deletion][Deleted from Auth0]');

      try {
        // delete locally
        const { orgCount, userId } = await deleteUserAndOrgs(user);
        result.orgCount = orgCount;
        result.localDatabaseId = userId;

        logger.debug({ userId: user.user_id, orgCount, localDatabaseId: userId }, '[inactive-account-deletion][Marked as deleted locally]');
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
    logger.debug('[inactive-account-deletion][Slack messages sent successfully]');
  } catch (ex) {
    logger.debug('[inactive-account-deletion][Slack messages error]');
  }
})();
