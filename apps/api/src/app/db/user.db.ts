import { User } from '.prisma/client';
import { ENV, logger, prisma } from '@jetstream/api-config';
import { UserProfileServer } from '@jetstream/types';

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
export async function createOrUpdateUser(user: UserProfileServer): Promise<{ created: boolean; user: User }> {
  try {
    const existingUser = await findByUserId(user.id);

    if (existingUser) {
      const updatedUser = await prisma.user.update({
        where: { userId: user.id },
        data: {
          appMetadata: JSON.stringify(user._json[ENV.AUTH_AUDIENCE]),
        },
      });
      logger.debug('[DB][USER][UPDATED] %s', user.id, { userId: user.id, id: existingUser.id });
      return { created: false, user: updatedUser };
    } else {
      const createdUser = await prisma.user.create({
        data: {
          userId: user.id,
          email: user._json.email,
          name: user._json.name,
          nickname: user._json.nickname,
          picture: user._json.picture,
          appMetadata: JSON.stringify(user._json[ENV.AUTH_AUDIENCE]),
        },
      });
      logger.debug('[DB][USER][CREATED] %s', user.id, { userId: user.id, id: createdUser.id });
      return { created: true, user: createdUser };
    }
  } catch (ex) {
    logger.error('[DB][USER][CREATE][ERROR] %o', ex, { user });
    throw ex;
  }
}
