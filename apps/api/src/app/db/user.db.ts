import { UserJSON } from '@clerk/backend';
import { getExceptionLog, logger, prisma } from '@jetstream/api-config';
import { UserWithId } from '@jetstream/types';
import { Prisma, User } from '@prisma/client';

const userSelect: Prisma.UserSelect = {
  appMetadata: true,
  createdAt: true,
  email: true,
  id: true,
  name: true,
  nickname: true,
  picture: true,
  preferences: {
    select: {
      skipFrontdoorLogin: true,
    },
  },
  updatedAt: true,
  userId: true,
};

/**
 * Find by Auth0 userId, not Jetstream Id
 */
export async function findByUserId(userId: string) {
  const user = await prisma.user.findUnique({
    where: { userId },
    select: userSelect,
  });
  return user;
}

export async function updateUser(user: UserWithId, data: { name: string; preferences: { skipFrontdoorLogin: boolean } }): Promise<User> {
  try {
    const existingUser = await prisma.user.findUnique({
      where: { userId: user.id },
      select: { id: true, preferences: { select: { skipFrontdoorLogin: true } } },
    });
    const skipFrontdoorLogin = data.preferences.skipFrontdoorLogin ?? (existingUser?.preferences?.skipFrontdoorLogin || false);
    const updatedUser = await prisma.user.update({
      where: { userId: user.id },
      data: {
        name: data.name,
        preferences: {
          upsert: {
            create: { skipFrontdoorLogin },
            update: { skipFrontdoorLogin },
          },
        },
      },
      select: userSelect,
    });
    return updatedUser;
  } catch (ex) {
    logger.error({ user, ...getExceptionLog(ex) }, '[DB][USER][UPDATE][ERROR]');
    throw ex;
  }
}

/**
 * This is called each time a user logs in (e.x. goes through OAuth2 flow with Auth Provider)
 */
export async function createOrUpdateUser(user: UserJSON): Promise<{ created: boolean; user: User }> {
  try {
    const existingUser = await findByUserId(user.external_id || user.id);

    if (existingUser) {
      const updatedUser = await prisma.user.update({
        where: { userId: user.id },
        data: {
          // TODO: do we want to store more info here?
          appMetadata: JSON.stringify(user.public_metadata || {}),
          preferences: {
            upsert: {
              create: { skipFrontdoorLogin: false },
              update: { skipFrontdoorLogin: false },
            },
          },
        },
        select: userSelect,
      });
      logger.debug({ userId: user.id, id: existingUser.id }, '[DB][USER][UPDATED] %s', user.id);
      return { created: false, user: updatedUser };
    } else {
      const createdUser = await prisma.user.create({
        data: {
          userId: user.id,
          email: user.email_addresses.find(({ id }) => id === user.primary_phone_number_id)?.email_address || 'unknown@unknown.com',
          name: `${user.first_name} ${user.last_name}`,
          picture: user.image_url,
          appMetadata: JSON.stringify(user.public_metadata || {}),
          // TODO: should we move this to unsafe_metadata?
          preferences: { create: { skipFrontdoorLogin: false } },
        },
        select: userSelect,
      });
      logger.debug({ userId: user.id, id: createdUser.id }, '[DB][USER][CREATED] %s', user.id);
      return { created: true, user: createdUser };
    }
  } catch (ex) {
    logger.error({ user, ...getExceptionLog(ex) }, '[DB][USER][CREATE][ERROR] %o', ex);
    throw ex;
  }
}
