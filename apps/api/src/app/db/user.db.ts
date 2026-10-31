import { logger, prisma } from '@jetstream/api-config';
import { getPendingEmailChangeForUser } from '@jetstream/auth/server';
import { UserProfileSession } from '@jetstream/auth/types';
import { Entitlement, Prisma } from '@jetstream/prisma';
import {
  Maybe,
  SoqlQueryFormatOptions,
  SoqlQueryFormatOptionsSchema,
  TeamMemberRole,
  TeamMemberStatusSchema,
  TeamStatusSchema,
  UserProfileUi,
  UserProfileUiSchema,
} from '@jetstream/types';
import { signFeatureFlags } from '../services/feature-flag-signing.service';
import { resolveFeatureFlagsForUser } from './feature-flags.db';

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
      analysisTools: true,
      chromeExtension: true,
      desktop: true,
      googleDrive: true,
      recordSync: true,
      salesforceCanvas: true,
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
      accessProfile: { select: { id: true, name: true, version: true, policy: true } },
      team: {
        select: {
          id: true,
          name: true,
          billingStatus: true,
          entitlements: {
            select: {
              analysisTools: true,
              chromeExtension: true,
              desktop: true,
              googleDrive: true,
              recordSync: true,
              salesforceCanvas: true,
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
  // pendingEmailChange rides along on the profile payload so the UI gets it without a second request
  // or any polling - every profile mutation already returns this shape. What counts as "pending" is
  // policy, so it is read through the canonical helper rather than restated here.
  const [user, pendingEmailChange] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      select: FullUserFacingProfileSelect,
      where: { id },
    }),
    getPendingEmailChangeForUser(id),
  ]);

  return { ...user, pendingEmailChange };
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
          analysisTools: true,
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

export const findIdByUserIdUserFacing = async ({
  userId,
  omitSubscriptions = false,
}: {
  userId: string;
  omitSubscriptions?: boolean;
}): Promise<UserProfileUi> => {
  const user = await prisma.user.findFirstOrThrow({ where: { id: userId }, select: UserFacingProfileSelect });
  // teamMembership is already filtered to an ACTIVE team by UserFacingProfileSelect; require an ACTIVE
  // membership too so team-scoped entitlements and flags match the rule in resolveActiveTeamIdForUser used by checkFeatureFlag.
  const hasActiveTeamMembership = user.teamMembership?.status === TeamMemberStatusSchema.enum.ACTIVE;
  const teamId = hasActiveTeamMembership ? (user.teamMembership?.team.id ?? null) : null;
  const featureFlags = await resolveFeatureFlagsForUser({ userId: user.id, teamId });
  // prefer team entitlements only for an active membership, otherwise user entitlements
  return UserProfileUiSchema.parse({
    ...user,
    entitlements: hasActiveTeamMembership ? (user.teamMembership?.team.entitlements ?? user.entitlements) : user.entitlements,
    subscriptions: omitSubscriptions ? [] : user.subscriptions,
    featureFlags,
    featureFlagsSignature: signFeatureFlags(user.id, featureFlags),
  });
};

/**
 * The access profile that applies to a user, or null for full access. Matches `/api/me`, which ignores the membership
 * of an inactive team, so the heartbeat fingerprint and the web surface check agree with the client.
 */
export const findActiveTeamAccessProfile = async ({ userId }: { userId: string }) => {
  const teamMembership = await prisma.teamMember.findFirst({
    select: { accessProfile: { select: { id: true, version: true, policy: true } } },
    where: { userId, team: { status: 'ACTIVE' } },
  });
  return teamMembership?.accessProfile ?? null;
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
  const teamMembership = userBillingAccount?.teamMembership;
  const hasActiveTeamMembership =
    teamMembership?.status === TeamMemberStatusSchema.enum.ACTIVE && teamMembership?.team?.status === TeamStatusSchema.enum.ACTIVE;
  if (hasActiveTeamMembership && teamMembership?.team?.billingAccount?.customerId) {
    return {
      customerId: teamMembership.team.billingAccount.customerId,
      manualBilling: teamMembership.team.billingAccount.manualBilling,
      teamId: teamMembership.team.id,
      teamRole: teamMembership.role as TeamMemberRole,
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

export const isPaidUser = async ({ teamId, userId }: { teamId: Maybe<string>; userId: string }): Promise<boolean> => {
  const hasIndividualSubscription = await prisma.subscription
    .count({ where: { userId, status: { in: ['ACTIVE', 'TRIALING'] } } })
    .then((result) => result > 0);
  if (hasIndividualSubscription) {
    return true;
  }
  if (!teamId) {
    return false;
  }
  const hasTeamSubscription = await prisma.teamSubscription
    .count({ where: { teamId, status: { in: ['ACTIVE', 'TRIALING'] } } })
    .then((result) => result > 0);
  return hasTeamSubscription;
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
  data: {
    name?: string;
    preferences?: { skipFrontdoorLogin?: boolean; recordSyncEnabled?: boolean; soqlQueryFormatOptions?: SoqlQueryFormatOptions };
  },
) {
  try {
    // PATCH update - only the fields that were sent are written, in one statement, so partial updates made at the
    // same time (e.g. from two devices) cannot undo each other. Prisma skips `undefined` fields.
    const preferenceChanges = {
      skipFrontdoorLogin: data.preferences?.skipFrontdoorLogin,
      recordSyncEnabled: data.preferences?.recordSyncEnabled,
      soqlQueryFormatOptions: data.preferences?.soqlQueryFormatOptions,
    };

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: data.name,
        preferences: {
          upsert: {
            create: {
              skipFrontdoorLogin: preferenceChanges.skipFrontdoorLogin ?? false,
              recordSyncEnabled: preferenceChanges.recordSyncEnabled ?? true,
              soqlQueryFormatOptions: preferenceChanges.soqlQueryFormatOptions ?? SoqlQueryFormatOptionsSchema.parse({}),
            },
            update: preferenceChanges,
          },
        },
      },
      select: FullUserFacingProfileSelect,
    });
    return updatedUser;
  } catch (ex) {
    logger.error({ user, err: ex }, '[DB][USER][UPDATE][ERROR]');
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

/** Subscription rows (stored upper-cased from Stripe) that mean the customer is still being paid for */
const PAID_SUBSCRIPTION_STATUSES = ['ACTIVE', 'TRIALING'];

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

/**
 * Points the user's billing account at `customerId`, creating it when there is none, and returns the customer that
 * holds the account afterwards. A caller compares it with `customerId` to learn whether this customer was bound.
 *
 * A user has one billing account (`userId` is unique), so it is looked up by `userId` alone. Looking it up by the
 * (userId, customerId) pair sent a checkout completing on a second customer into a create that hit that constraint,
 * so the user was charged and the webhook retried forever with nothing recorded.
 *
 * The account only moves to another customer when `canRepoint` (that customer's subscription is being paid for) and
 * the current customer has no paid subscription recorded. `subscription.customerId` follows the account
 * (ON UPDATE CASCADE) and the next sync deletes the rows that are not current, so an event from an abandoned customer
 * must not take the account, and two paid customers is a double charge for a human to refund rather than an account
 * that flips between them on every event.
 */
export async function upsertBillingAccount({
  userId,
  customerId,
  canRepoint,
}: {
  userId: string;
  customerId: string;
  canRepoint: boolean;
}): Promise<{ customerId: string }> {
  const billingAccount = await prisma.billingAccount.findUnique({
    where: { userId },
    select: {
      customerId: true,
      subscriptions: { where: { status: { in: PAID_SUBSCRIPTION_STATUSES } }, select: { subscriptionId: true } },
    },
  });

  if (!billingAccount) {
    try {
      return await prisma.billingAccount.create({ data: { customerId, userId }, select: { customerId: true } });
    } catch (ex) {
      // A concurrent event for the same user created it first
      if (isUniqueConstraintError(ex)) {
        return await prisma.billingAccount.findUniqueOrThrow({ where: { userId }, select: { customerId: true } });
      }
      throw ex;
    }
  }

  if (billingAccount.customerId === customerId) {
    return { customerId };
  }

  if (!canRepoint) {
    logger.warn(
      { userId, customerId, billingAccountCustomerId: billingAccount.customerId },
      '[BILLING]: Not moving the billing account to a customer without a paid subscription',
    );
    return { customerId: billingAccount.customerId };
  }

  if (billingAccount.subscriptions.length > 0) {
    logger.error(
      {
        userId,
        customerId,
        billingAccountCustomerId: billingAccount.customerId,
        billingAccountSubscriptionIds: billingAccount.subscriptions.map(({ subscriptionId }) => subscriptionId),
      },
      '[BILLING]: A user is paying on two Stripe customers, the billing account stays on the first, review for a refund',
    );
    return { customerId: billingAccount.customerId };
  }

  // Compared inside the write so a concurrent event that already moved the account is not overwritten
  const { count } = await prisma.billingAccount.updateMany({
    where: { userId, customerId: billingAccount.customerId },
    data: { customerId },
  });
  if (count === 0) {
    return await prisma.billingAccount.findUniqueOrThrow({ where: { userId }, select: { customerId: true } });
  }
  logger.info(
    { userId, customerId, previousCustomerId: billingAccount.customerId },
    '[BILLING]: Moved the billing account to the customer being paid for',
  );
  return { customerId };
}
