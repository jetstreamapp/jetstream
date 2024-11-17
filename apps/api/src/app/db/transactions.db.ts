import { getExceptionLog, logger, prisma } from '@jetstream/api-config';
import { PrismaPromise } from '@prisma/client';

/**
 * This file manages db operations as transactions that span multiple tables
 */

/**
 * Hard delete all orgs and users for a given org.
 * If no user exists or no orgs exist, then no db transaction is submitted
 *
 * Use this when linking two user accounts for the secondary account
 *
 * @param userId
 */
export async function hardDeleteUserAndOrgs(userId: string) {
  if (!userId) {
    throw new Error('A valid userId must be provided');
  }
  try {
    const dbTransactions: PrismaPromise<unknown>[] = [];

    if ((await prisma.salesforceOrg.count({ where: { jetstreamUserId: userId } })) > 0) {
      dbTransactions.push(
        prisma.salesforceOrg.deleteMany({
          where: { jetstreamUserId: userId },
        })
      );
    }

    if ((await prisma.user.count({ where: { userId: userId } })) > 0) {
      dbTransactions.push(
        prisma.user.deleteMany({
          where: { userId },
        })
      );
    }

    if (dbTransactions.length) {
      await prisma.$transaction(dbTransactions);
    }
  } catch (ex) {
    logger.error({ userId, ...getExceptionLog(ex) }, '[DB][TX][DEL_ORGS_AND_USER][ERROR] %o', ex);
    throw ex;
  }
}
