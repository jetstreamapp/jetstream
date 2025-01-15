import { getExceptionLog, logger, prisma } from '@jetstream/api-config';
import { UserProfileSession } from '@jetstream/auth/types';
import { Entitlement, Prisma, User } from '@prisma/client';

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
  entitlements: {
    select: {
      recordSync: true,
      chromeExtension: true,
    },
  },
  subscriptions: {
    where: { status: 'ACTIVE' },
    take: 1,
    select: {
      id: true,
      providerId: true,
      customerId: true,
      planId: true,
      status: true,
    },
  },
  updatedAt: true,
  userId: true,
};

const FullUserFacingProfileSelect = Prisma.validator<Prisma.UserSelect & { hasPasswordSet?: boolean }>()({
  id: true,
  userId: true,
  name: true,
  email: true,
  emailVerified: true,
  appMetadata: false,
  picture: true,
  preferences: true,
  hasPasswordSet: true,
  identities: {
    select: {
      type: true,
      email: true,
      emailVerified: true,
      familyName: true,
      givenName: true,
      name: true,
      picture: true,
      provider: true,
      providerAccountId: true,
      isPrimary: true,
      username: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  authFactors: {
    select: {
      type: true,
      enabled: true,
      createdAt: true,
      updatedAt: true,
    },
  },
  subscriptions: {
    where: { status: 'ACTIVE' },
    take: 1,
    select: {
      id: true,
      providerId: true,
      customerId: true,
      planId: true,
      status: true,
    },
  },
  createdAt: true,
  updatedAt: true,
});

const UserFacingProfileSelect = Prisma.validator<Prisma.UserSelect>()({
  id: true,
  userId: true,
  name: true,
  email: true,
  emailVerified: true,
  picture: true,
  preferences: true,
  subscriptions: {
    where: { status: 'ACTIVE' },
    take: 1,
    select: {
      id: true,
      providerId: true,
      customerId: true,
      planId: true,
      status: true,
    },
  },
});

export async function findUserWithIdentitiesById(id: string) {
  return await prisma.user.findUniqueOrThrow({
    select: FullUserFacingProfileSelect,
    where: { id },
  });
}

export const findById = (id: string) => {
  return prisma.user.findFirstOrThrow({ where: { id }, select: UserFacingProfileSelect });
};

export const findIdByUserIdUserFacing = ({ userId }: { userId: string }) => {
  return prisma.user.findFirstOrThrow({ where: { id: userId }, select: UserFacingProfileSelect }).then(({ id }) => id);
};

export const checkUserEntitlement = ({
  userId,
  entitlement,
}: {
  userId: string;
  entitlement: keyof Omit<Entitlement, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;
}): Promise<boolean> => {
  return prisma.entitlement.count({ where: { userId, [entitlement]: true } }).then((result) => result > 0);
};

export async function updateUser(
  user: UserProfileSession,
  data: { name?: string; preferences?: { skipFrontdoorLogin: boolean } }
): Promise<User> {
  try {
    const existingUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { id: true, name: true, preferences: { select: { skipFrontdoorLogin: true } } },
    });
    const skipFrontdoorLogin = data.preferences?.skipFrontdoorLogin ?? (existingUser?.preferences?.skipFrontdoorLogin || false);
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: data.name ?? existingUser.name,
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

export async function deleteUserAndAllRelatedData(userId: string): Promise<void> {
  const existingUser = await prisma.user.findFirstOrThrow({ where: { id: userId }, select: { id: true } });
  if (!existingUser) {
    throw new Error(`User with id ${userId} not found`);
  }
  // This cascades to delete all related data
  await prisma.user.delete({ where: { id: userId } });
  await prisma.sessions.deleteMany({
    where: {
      sess: {
        path: ['user', 'id'],
        equals: userId,
      },
    },
  });
}
