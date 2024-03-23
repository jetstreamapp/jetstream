import { getExceptionLog, logger, prisma } from '@jetstream/api-config';
import { UserProfileServer } from '@jetstream/types';
import { PrismaPromise } from '@prisma/client';

/**
 * This file manages db operations as transactions that span multiple tables
 */

export async function deleteUserAndOrgs(user: UserProfileServer) {
  if (!user?.id) {
    throw new Error('A valid user must be provided');
  }
  try {
    const deleteOrgs = prisma.salesforceOrg.deleteMany({
      where: { jetstreamUserId: user.id },
    });

    const deleteUser = prisma.user.update({
      where: { userId: user.id },
      data: {
        deletedAt: new Date(),
      },
    });

    await prisma.$transaction([deleteOrgs, deleteUser]);
  } catch (ex) {
    logger.error({ userId: user?.id, ...getExceptionLog(ex) }, '[DB][TX][DEL_ORGS_AND_USER][ERROR] %o', ex);
    throw ex;
  }
}

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
    const dbTransactions: PrismaPromise<any>[] = [];

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
