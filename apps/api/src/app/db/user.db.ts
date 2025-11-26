import { getExceptionLog, logger, prisma } from '@jetstream/api-config';
import { UserProfileSession } from '@jetstream/auth/types';
import { Entitlement, Prisma } from '@jetstream/prisma';
import { TeamMemberRole, UserProfileUi, UserProfileUiSchema } from '@jetstream/types';

const FullUserFacingProfileSelect = {
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
  teamMembership: {
    where: {
      status: 'ACTIVE',
    },
    select: {
      role: true,
      team: {
        select: {
          id: true,
          name: true,
          billingStatus: true,
        },
      },
    },
  },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.UserSelect & { hasPasswordSet?: boolean };

const UserFacingProfileSelect = {
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
  teamMembership: {
    select: {
      role: true,
      status: true,
      team: {
        select: {
          id: true,
          name: true,
          billingStatus: true,
          entitlements: {
            select: {
              chromeExtension: true,
              desktop: true,
              googleDrive: true,
              recordSync: true,
            },
          },
        },
      },
    },
    where: {
      team: {
        status: 'ACTIVE',
      },
    },
  },
} satisfies Prisma.UserSelect;

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
    select: {
      id: true,
      email: true,
      name: true,
      entitlements: {
        select: {
          chromeExtension: true,
          desktop: true,
          googleDrive: true,
          recordSync: true,
        },
      },
      billingAccount: {
        select: { customerId: true, manualBilling: true },
      },
      subscriptions: {
        select: {
          id: true,
          customerId: true,
          productId: true,
          subscriptionId: true,
          priceId: true,
          status: true,
        },
        where: { status: 'ACTIVE' },
      },
    },
    where: { id },
  });
};

export const findIdByUserIdUserFacing = ({
  userId,
  omitSubscriptions = false,
}: {
  userId: string;
  omitSubscriptions?: boolean;
}): Promise<UserProfileUi> => {
  return prisma.user.findFirstOrThrow({ where: { id: userId }, select: UserFacingProfileSelect }).then((user) => {
    // prefer team entitlements if exists, otherwise user entitlements
    return UserProfileUiSchema.parse({
      ...user,
      entitlements: user.teamMembership?.team.entitlements ?? user.entitlements,
      subscriptions: omitSubscriptions ? [] : user.subscriptions,
    });
  });
};

export const getBillingAccount = async (id: string) => {
  const userBillingAccount = await prisma.user.findFirst({
    where: { id },
    select: {
      billingAccount: { select: { customerId: true, manualBilling: true } },
      teamMembership: {
        select: {
          status: true,
          role: true,
          team: { select: { id: true, status: true, billingAccount: { select: { customerId: true, manualBilling: true } } } },
        },
      },
    },
  });
  if (userBillingAccount?.teamMembership?.team?.billingAccount?.customerId) {
    return {
      customerId: userBillingAccount.teamMembership.team.billingAccount.customerId,
      manualBilling: userBillingAccount.teamMembership.team.billingAccount.manualBilling,
      teamId: userBillingAccount.teamMembership.team.id,
      teamRole: userBillingAccount.teamMembership.role as TeamMemberRole,
    };
  }
  if (userBillingAccount?.billingAccount?.customerId) {
    return {
      customerId: userBillingAccount.billingAccount.customerId,
      manualBilling: userBillingAccount.billingAccount.manualBilling,
      teamId: null,
      teamRole: null,
    };
  }
  return null;
};

export const hasManualBilling = async ({ userId }: { userId: string }): Promise<boolean> => {
  const userBillingAccount = await prisma.user.findFirst({
    where: { id: userId },
    select: {
      billingAccount: { select: { manualBilling: true } },
      teamMembership: { select: { team: { select: { billingAccount: { select: { manualBilling: true } } } } } },
    },
  });
  if (userBillingAccount?.teamMembership?.team?.billingAccount?.manualBilling) {
    return true;
  }
  if (userBillingAccount?.billingAccount?.manualBilling) {
    return true;
  }
  return false;
};

export const checkUserEntitlement = async ({
  userId,
  entitlement,
}: {
  userId: string;
  entitlement: keyof Omit<Entitlement, 'id' | 'userId' | 'createdAt' | 'updatedAt'>;
}): Promise<boolean> => {
  // prefer team entitlement if exists, otherwise check user entitlement
  const teamId = await prisma.teamMember
    .findFirst({ select: { teamId: true }, where: { userId, status: 'ACTIVE' } })
    .then((team) => team?.teamId);

  if (teamId) {
    return prisma.teamEntitlement.count({ where: { teamId, [entitlement]: true } }).then((result) => result > 0);
  }

  return prisma.entitlement.count({ where: { userId, [entitlement]: true } }).then((result) => result > 0);
};

export async function updateUser(
  user: UserProfileSession,
  data: { name?: string; preferences?: { skipFrontdoorLogin?: boolean; recordSyncEnabled?: boolean } },
) {
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
      select: FullUserFacingProfileSelect,
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

export async function upsertBillingAccount({ userId, customerId }: { userId: string; customerId: string }) {
  const existingCustomer = await prisma.billingAccount.findUnique({ where: { uniqueCustomer: { customerId, userId } } });
  if (existingCustomer) {
    return existingCustomer;
  }
  return await prisma.billingAccount.create({
    data: { customerId, userId },
  });
}
