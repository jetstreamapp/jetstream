import { getExceptionLog, logger, prisma } from '@jetstream/api-config';
import { UserProfileSession } from '@jetstream/auth/types';
import { UserProfileUi } from '@jetstream/types';
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
      chromeExtension: true,
      desktop: true,
      googleDrive: true,
      recordSync: true,
    },
  },
  billingAccount: {
    select: {
      customerId: true,
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
  billingAccount: {
    select: {
      customerId: true,
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
  billingAccount: {
    select: {
      customerId: true,
    },
  },
  entitlements: {
    select: {
      chromeExtension: true,
      desktop: true,
      googleDrive: true,
      recordSync: true,
    },
  },
  subscriptions: {
    select: {
      id: true,
      productId: true,
      subscriptionId: true,
      priceId: true,
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

export const findByIdWithSubscriptions = (id: string) => {
  return prisma.user.findFirstOrThrow({
    where: { id },
    select: {
      ...userSelect,
      subscriptions: {
        where: { status: 'ACTIVE' },
        select: {
          id: true,
          customerId: true,
          productId: true,
          subscriptionId: true,
          priceId: true,
          status: true,
        },
      },
    },
  });
};

export const findIdByUserIdUserFacing = ({
  userId,
  omitSubscriptions = false,
}: {
  userId: string;
  omitSubscriptions?: boolean;
}): Promise<UserProfileUi> => {
  return prisma.user.findFirstOrThrow({ where: { id: userId }, select: UserFacingProfileSelect }).then((user) => ({
    id: user.id,
    userId: user.userId,
    email: user.email,
    name: user.name,
    emailVerified: user.emailVerified,
    picture: user.picture,
    preferences: { skipFrontdoorLogin: false, recordSyncEnabled: true },
    billingAccount: user.billingAccount,
    entitlements: {
      chromeExtension: user.entitlements?.chromeExtension ?? true,
      recordSync: user.entitlements?.recordSync ?? false,
      googleDrive: user.entitlements?.googleDrive ?? false,
      desktop: user.entitlements?.desktop ?? false,
    },
    subscriptions: omitSubscriptions
      ? []
      : user.subscriptions.map((subscription) => ({
          id: subscription.id,
          productId: subscription.productId,
          subscriptionId: subscription.subscriptionId,
          priceId: subscription.priceId,
          status: subscription.status as UserProfileUi['subscriptions'][number]['status'],
        })),
  }));
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
  data: { name?: string; preferences?: { skipFrontdoorLogin?: boolean; recordSyncEnabled?: boolean } }
): Promise<User> {
  try {
    const existingUser = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { id: true, name: true, preferences: { select: { skipFrontdoorLogin: true, recordSyncEnabled: true } } },
    });
    // PATCH update
    const skipFrontdoorLogin = data.preferences?.skipFrontdoorLogin ?? existingUser?.preferences?.skipFrontdoorLogin ?? false;
    const recordSyncEnabled = data.preferences?.recordSyncEnabled ?? existingUser?.preferences?.recordSyncEnabled ?? true;

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: data.name ?? existingUser.name,
        preferences: {
          upsert: {
            create: { skipFrontdoorLogin, recordSyncEnabled },
            update: { skipFrontdoorLogin, recordSyncEnabled },
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

export async function findBillingAccountByCustomerId({ customerId }: { customerId: string }) {
  const billingAccount = await prisma.billingAccount.findFirst({ where: { customerId } });
  return billingAccount;
}

export async function createBillingAccountIfNotExists({ userId, customerId }: { userId: string; customerId: string }) {
  const existingCustomer = await prisma.billingAccount.findUnique({ where: { uniqueCustomer: { customerId, userId } } });
  if (existingCustomer) {
    return existingCustomer;
  }
  return await prisma.billingAccount.create({
    data: { customerId, userId },
  });
}
