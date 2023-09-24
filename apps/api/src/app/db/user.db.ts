import { ENV, logger, prisma } from '@jetstream/api-config';
import { UserProfileServer, UserProfileUi } from '@jetstream/types';
import { User } from '@prisma/client';

/**
 * Find by Auth0 userId, not Jetstream Id
 */
async function findByUserId(userId: string) {
  return await prisma.user.findUnique({
    where: { userId: userId },
  });
}

export async function updateUser(user: UserProfileServer, data: { name: string }): Promise<User> {
  try {
    const updatedUser = await prisma.user.update({
      where: { userId: user.id },
      data: { name: data.name },
    });
    return updatedUser;
  } catch (ex) {
    logger.error('[DB][USER][UPDATE][ERROR] %o', ex, { user });
    throw ex;
  }
}

/**
 * This is called each time a user logs in (e.x. goes through OAuth2 flow with Auth Provider)
 */
export async function createOrUpdateUser(user: UserProfileUi): Promise<{ created: boolean; user: User }> {
  try {
    const existingUser = await findByUserId(user.sub);

    if (existingUser) {
      const updatedUser = await prisma.user.update({
        where: { userId: user.sub },
        data: {
          appMetadata: JSON.stringify(user[ENV.AUTH_AUDIENCE!]),
        },
      });
      logger.debug('[DB][USER][UPDATED] %s', user.sub, { userId: user.sub, id: existingUser.id });
      return { created: false, user: updatedUser };
    } else {
      const createdUser = await prisma.user.create({
        data: {
          userId: user.sub,
          email: user.email,
          name: user.name,
          nickname: user.nickname,
          picture: user.picture,
          appMetadata: JSON.stringify(user[ENV.AUTH_AUDIENCE!]),
        },
      });
      logger.debug('[DB][USER][CREATED] %s', user.sub, { userId: user.sub, id: createdUser.id });
      return { created: true, user: createdUser };
    }
  } catch (ex) {
    logger.error('[DB][USER][CREATE][ERROR] %o', ex, { user });
    throw ex;
  }
}
