import { UserProfileAuth0 } from '@jetstream/types';
import { prisma } from '../config/db.config';
import { logger } from '../config/logger.config';

export async function deleteUserAndOrgs(user: UserProfileAuth0) {
  if (!user?.user_id) {
    throw new Error('A valid user must be provided');
  }
  try {
    const deleteOrgs = prisma.salesforceOrg.deleteMany({
      where: { jetstreamUserId: user.user_id },
    });

    const deleteUser = prisma.user.update({
      where: { userId: user.user_id },
      data: {
        deletedAt: new Date(),
      },
    });

    const results = await prisma.$transaction([deleteOrgs, deleteUser]);
    return {
      orgCount: results[0].count,
      userId: results[1].id,
    };
  } catch (ex) {
    logger.error({ message: ex.message, stack: ex.stack }, '[DB][TX][DEL_ORGS_AND_USER][ERROR]');
    throw ex;
  }
}
