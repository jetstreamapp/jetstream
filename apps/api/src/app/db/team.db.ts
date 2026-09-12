import { logger, prisma } from '@jetstream/api-config';
import { clearLoginConfigurationCacheItem, resolveSamlIdentifiers } from '@jetstream/auth/server';
import {
  LoginConfigurationWithCallbacks,
  LoginConfigurationWithCallbacksSchema,
  OidcConfigurationRequest,
  SamlConfigurationRequest,
  SessionData,
  UserProfileSession,
} from '@jetstream/auth/types';
import { Prisma } from '@jetstream/prisma';
import { computeNextCertNotificationDate } from '@jetstream/shared/utils';
import {
  addMemberFromInvitation,
  assertSeatAvailable,
  isBillableRole,
  isSeatConsumingMember,
  isSeatReservingInvitation,
  summarizeSeatsFromTeam,
  withTeamSeatLock,
} from '@jetstream/team-seats';
import {
  DomainVerificationSchema,
  Maybe,
  TEAM_MEMBER_ROLE_ADMIN,
  TEAM_MEMBER_ROLE_BILLING,
  TEAM_MEMBER_STATUS_ACTIVE,
  TeamEntitlementSchema,
  TeamInvitationRequest,
  TeamInvitationUpdateRequest,
  TeamInviteUserFacingSchema,
  TeamLoginConfig,
  TeamLoginConfigRequest,
  TeamLoginConfigSchema,
  TeamMember,
  TeamMemberRole,
  TeamMemberSchema,
  TeamMemberStatus,
  TeamMemberUpdateRequest,
  TeamMemberUpdateRequestSchema,
  TeamStatus,
  TeamStatusSchema,
  TeamSubscriptionSchema,
  TeamUserFacing,
  TeamUserFacingSchema,
  TeamVerificationStatusSchema,
} from '@jetstream/types';
import { X509Certificate } from 'crypto';
import { addDays, endOfDay } from 'date-fns';
import { groupBy, isString } from 'lodash';
import { NotAllowedError, NotFoundError, UserFacingError } from '../utils/error-handler';

export const TEAM_INVITE_EXPIRES_DAYS = 14;

const INVITE_SELECT = {
  id: true,
  email: true,
  expiresAt: true,
  features: true,
  lastSentAt: true,
  role: true,
  team: { select: { name: true } },
  token: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TeamMemberInvitationSelect;

const SELECT_TEAM_MEMBER = {
  teamId: true,
  features: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
  userId: true,
  user: {
    select: {
      id: true,
      email: true,
      name: true,
      lastLoggedIn: true,
      emailVerified: true,
      passwordUpdatedAt: true,
      hasPasswordSet: true,
      identities: {
        select: {
          email: true,
          username: true,
          provider: true,
          isPrimary: true,
          type: true,
          samlConfiguration: { select: { name: true } },
          oidcConfiguration: { select: { name: true } },
        },
      },
      authFactors: {
        select: {
          enabled: true,
          type: true,
        },
      },
    },
  },
} satisfies Prisma.TeamMemberSelect;

/**
 * Full team graph behind the user-facing payload. A function rather than a const because the
 * invitation list is relative to now: invitations that expired within the last
 * TEAM_INVITE_EXPIRES_DAYS days are still listed (the UI shows them as expired so an admin can
 * resend them), matching the window getTeamInvitations uses.
 */
function selectTeamWithRelated() {
  return {
    id: true,
    name: true,
    loginConfigId: true,
    status: true,
    billingStatus: true,
    sharedOrgs: {
      select: {
        uniqueId: true,
        displayName: true,
        instanceUrl: true,
        organizationId: true,
        userId: true,
        username: true,
        jetstreamUserId2: true,
      },
    },
    billingAccount: {
      select: {
        customerId: true,
        manualBilling: true,
        licenseCountLimit: true,
        includedSeats: true,
        pendingSeatQuantity: true,
        pendingSeatEffectiveAt: true,
      },
    },
    members: {
      select: SELECT_TEAM_MEMBER,
      orderBy: { user: { name: 'asc' } },
    },
    invitations: {
      select: INVITE_SELECT,
      where: { expiresAt: { gte: addDays(new Date(), -TEAM_INVITE_EXPIRES_DAYS) } },
    },
    loginConfig: {
      select: {
        allowedMfaMethods: true,
        allowedProviders: true,
        allowIdentityLinking: true,
        autoAddToTeam: true,
        domains: true,
        requireMfa: true,
        ssoProvider: true,
        ssoEnabled: true,
        ssoRequireMfa: true,
        ssoJitProvisioningEnabled: true,
      },
    },
    subscriptions: {
      select: {
        status: true,
      },
    },
    createdAt: true,
    updatedAt: true,
  } satisfies Prisma.TeamSelect;
}

type TeamWithRelated = Prisma.TeamGetPayload<{ select: ReturnType<typeof selectTeamWithRelated> }>;

function sortTeamMembers(members: TeamMember[], runningUserId: string) {
  members.sort((a, b) => {
    if (a.userId === runningUserId) return -1; // Move current user to the top
    if (b.userId === runningUserId) return 1; // Move current user to the top
    return a.user.name.localeCompare(b.user.name);
  });
}

/**
 * Builds the API payload from the loaded team graph. `seats` is derived here so every surface shares
 * one seat definition instead of recomputing it from members and invitations.
 */
function toTeamUserFacing(team: TeamWithRelated, runningUserId?: string): TeamUserFacing {
  const userFacingTeam = TeamUserFacingSchema.parse({ ...team, seats: summarizeSeatsFromTeam(team) });
  if (runningUserId) {
    sortTeamMembers(userFacingTeam.members, runningUserId);
  }
  return userFacingTeam;
}

export const findById = async ({ teamId, runningUserId }: { teamId: string; runningUserId?: string }) => {
  return await prisma.team
    .findFirstOrThrow({
      select: selectTeamWithRelated(),
      where: { id: teamId },
    })
    .then((team) => toTeamUserFacing(team, runningUserId));
};

export const findByUserId = async ({ userId }: { userId: string }) => {
  return await prisma.team
    .findFirstOrThrow({
      select: selectTeamWithRelated(),
      where: {
        members: { some: { userId, role: { in: [TEAM_MEMBER_ROLE_ADMIN, TEAM_MEMBER_ROLE_BILLING] } } },
      },
    })
    .then((team) => toTeamUserFacing(team, userId));
};

/**
 * Checks if a user has any of the specified roles within their team (user is allowed to be in exactly one team)
 * This can be used for permission checks
 */
export const doesUserHaveSpecifiedRoles = async ({ userId, roles }: { userId: string; roles: TeamMemberRole[] }) => {
  const count = await prisma.teamMember.count({
    where: { userId, role: { in: roles } },
  });
  return count > 0;
};

/** Current role and status of a member, used to describe what a blocked membership change was attempting. */
export const findMemberRoleAndStatus = async ({ teamId, userId }: { teamId: string; userId: string }) => {
  return prisma.teamMember.findUnique({
    select: { role: true, status: true },
    where: { teamId_userId: { teamId, userId } },
  });
};

/**
 * Only use for internal use-cases, do not expose to users.
 */
export const findByUserIdWithTeamMember_UNSAFE = async ({ userId }: { userId: string }) => {
  return await prisma.team.findFirst({
    select: {
      id: true,
      name: true,
      status: true,
      billingAccount: {
        select: { customerId: true, manualBilling: true },
      },
      members: {
        select: {
          userId: true,
          role: true,
          status: true,
        },
        where: { userId },
      },
    },
    where: {
      members: { some: { userId } },
    },
  });
};

export const checkTeamRole = async ({ teamId, userId, roles }: { teamId: string; userId: string; roles: TeamMemberRole[] }) => {
  return prisma.teamMember
    .count({
      where: {
        teamId,
        userId,
        team: { status: TeamStatusSchema.enum.ACTIVE },
        role: { in: roles },
        status: TEAM_MEMBER_STATUS_ACTIVE,
      },
    })
    .then((count) => count > 0);
};

export const findActiveTeamMembershipForRoles = async ({
  teamId,
  userId,
  roles,
}: {
  teamId: string;
  userId: string;
  roles: TeamMemberRole[];
}) => {
  return prisma.teamMember.findFirst({
    select: { teamId: true, role: true, status: true },
    where: {
      teamId,
      userId,
      team: { status: TeamStatusSchema.enum.ACTIVE },
      role: { in: roles },
      status: TEAM_MEMBER_STATUS_ACTIVE,
    },
  });
};

/**
 * Lightweight lookup of the caller's active team membership (a user has at most one team).
 * Use this when a caller only needs the current role/teamId for authorization — it avoids
 * pulling the full team + subscriptions + billingAccount graph that findByUserIdWithSubscriptions
 * returns, which is wasted work when the caller is a MEMBER and the controller short-circuits.
 */
export const findActiveTeamMembershipByUserId = async ({ userId }: { userId: string }) => {
  return prisma.teamMember.findFirst({
    select: { teamId: true, role: true, status: true },
    where: {
      userId,
      status: TEAM_MEMBER_STATUS_ACTIVE,
      team: { status: TeamStatusSchema.enum.ACTIVE },
    },
  });
};

export const findEntitlements = async ({ teamId }: { teamId: string }) => {
  return prisma.teamEntitlement
    .findFirst({
      where: { teamId },
    })
    .then((entitlements) => TeamEntitlementSchema.parse(entitlements || {}));
};

export const findSubscriptions = async ({ teamId }: { teamId: string }) => {
  return prisma.teamSubscription
    .findMany({
      where: { teamId },
    })
    .then((records) => TeamSubscriptionSchema.array().parse(records));
};

export const findByUserIdWithSubscriptions = async ({ userId }: { userId: string }) => {
  return prisma.team.findFirst({
    select: {
      id: true,
      status: true,
      name: true,
      billingStatus: true,
      billingAccount: {
        select: { customerId: true, manualBilling: true },
      },
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
      members: {
        select: { role: true, status: true, userId: true },
        where: { userId },
      },
    },
    where: {
      members: { some: { userId } },
    },
  });
};

export const createTeam = async ({
  name,
  userId,
  status = 'ACTIVE',
  loginConfiguration,
}: {
  name: string;
  userId: string;
  status?: TeamStatus;
  loginConfiguration: TeamLoginConfig;
}): Promise<TeamUserFacing> => {
  // ensure user is not part of another team
  const existingTeam = await prisma.teamMember.findFirst({
    select: { userId: true },
    where: { userId, team: { members: { some: { userId } } } },
  });

  if (existingTeam) {
    throw new Error(`User with ID ${userId} is already a member of another team.`);
  }

  const team = await prisma.team
    .create({
      select: selectTeamWithRelated(),
      data: {
        name,
        status,
        createdByUser: { connect: { id: userId } },
        updatedByUser: { connect: { id: userId } },
        members: {
          create: {
            userId,
            role: TEAM_MEMBER_ROLE_ADMIN,
            status: TEAM_MEMBER_STATUS_ACTIVE,
            createdById: userId,
            updatedById: userId,
          },
        },
        loginConfig: {
          create: { ...loginConfiguration, createdById: userId, updatedById: userId },
        },
        entitlements: {
          create: {
            chromeExtension: false,
            googleDrive: false,
            desktop: false,
            recordSync: false,
            salesforceCanvas: false,
          },
        },
      },
    })
    .then((team) => toTeamUserFacing(team));

  return team;
};

export const upsertTeamWithBillingAccount = async ({
  userId,
  billingAccountCustomerId,
  name,
  status = 'ACTIVE',
  manualBilling,
}: {
  userId: string;
  billingAccountCustomerId: string;
  /**
   * Defaults to email address if not specified
   */
  name?: string;
  /**
   * Desired status, defaults to ACTIVE
   */
  status?: TeamStatus;
  /**
   * Enable manual billing, this means that adding users will not interact with Stripe
   */
  manualBilling?: boolean;
}) => {
  // ensure user is not part of another team
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } });
  const existingTeam = await prisma.teamMember.findFirst({
    select: { userId: true, teamId: true, team: { select: { billingAccount: { select: { customerId: true } } } } },
    where: { userId, team: { members: { some: { userId } } } },
  });

  if (existingTeam) {
    return prisma.team.update({
      select: { id: true },
      data: {
        status,
        billingAccount: existingTeam.team.billingAccount
          ? { update: { manualBilling } }
          : { create: { customerId: billingAccountCustomerId, manualBilling } },
        updatedById: userId,
      },
      where: { id: existingTeam.teamId },
    });
  }

  return prisma.team.create({
    select: { id: true },
    data: {
      name: name || user.email,
      status,
      createdByUser: { connect: { id: userId } },
      updatedByUser: { connect: { id: userId } },
      members: {
        create: {
          userId,
          role: TEAM_MEMBER_ROLE_ADMIN,
          status: TEAM_MEMBER_STATUS_ACTIVE,
          createdById: userId,
          updatedById: userId,
        },
      },
      entitlements: {
        create: {},
      },
      loginConfig: {
        create: {
          createdById: userId,
          updatedById: userId,
        },
      },
      billingAccount: {
        create: {
          customerId: billingAccountCustomerId,
          manualBilling,
        },
      },
    },
  });
};

export const updateTeam = async ({
  teamId,
  runningUserId,
  payload,
}: {
  teamId: string;
  runningUserId: string;
  payload: { name: string };
}) => {
  return await prisma.team
    .update({
      select: selectTeamWithRelated(),
      where: { id: teamId },
      data: { name: payload.name, updatedById: runningUserId },
    })
    .then((team) => toTeamUserFacing(team, runningUserId));
};

export const updateLoginConfiguration = async ({
  teamId,
  runningUserId,
  loginConfiguration,
}: {
  teamId: string;
  runningUserId: string;
  loginConfiguration: TeamLoginConfigRequest;
}) => {
  const team = await prisma.team.findFirstOrThrow({
    select: { id: true, loginConfigId: true },
    where: { id: teamId },
  });

  // Capture previous config values for audit log diff
  const previousLoginConfig = team.loginConfigId
    ? await prisma.loginConfiguration.findUnique({
        where: { id: team.loginConfigId },
        select: {
          requireMfa: true,
          allowIdentityLinking: true,
          autoAddToTeam: true,
          allowedMfaMethods: true,
          allowedProviders: true,
          ssoRequireMfa: true,
          ssoEnabled: true,
          ssoProvider: true,
        },
      })
    : null;

  // SSO counts as a login provider, so an empty provider list is only valid when SSO is active
  if (loginConfiguration.allowedProviders.length === 0) {
    const ssoIsActive = !!previousLoginConfig && previousLoginConfig.ssoEnabled && previousLoginConfig.ssoProvider !== 'NONE';
    if (!ssoIsActive) {
      throw new UserFacingError('At least one login provider must be selected when SSO is not enabled.');
    }
  }

  if (!team.loginConfigId) {
    await prisma.loginConfiguration.create({
      data: {
        allowedMfaMethods: loginConfiguration.allowedMfaMethods,
        allowedProviders: loginConfiguration.allowedProviders,
        allowIdentityLinking: loginConfiguration.allowIdentityLinking,
        requireMfa: loginConfiguration.requireMfa,
        ssoRequireMfa: loginConfiguration.ssoRequireMfa,
        updatedById: runningUserId,
        createdById: runningUserId,
        team: {
          connect: { id: team.id },
        },
      },
    });
  } else {
    await prisma.loginConfiguration.update({
      where: { id: team.loginConfigId },
      data: {
        allowedMfaMethods: loginConfiguration.allowedMfaMethods,
        allowedProviders: loginConfiguration.allowedProviders,
        allowIdentityLinking: loginConfiguration.allowIdentityLinking,
        requireMfa: loginConfiguration.requireMfa,
        ssoRequireMfa: loginConfiguration.ssoRequireMfa,
        updatedById: runningUserId,
      },
    });
  }

  clearLoginConfigurationCacheItem(team.id);

  const updatedTeam = await findById({ teamId: team.id, runningUserId });
  return { team: updatedTeam, previousLoginConfig };
};

export async function revokeSessionThatViolateLoginConfiguration({
  teamId,
  skipUserIds,
}: {
  teamId: string;
  skipUserIds?: string[];
}): Promise<number> {
  const team = await prisma.team.findFirstOrThrow({
    select: {
      loginConfig: {
        select: {
          allowedMfaMethods: true,
          allowedProviders: true,
          requireMfa: true,
          ssoEnabled: true,
          ssoProvider: true,
        },
      },
      members: {
        select: {
          userId: true,
          user: {
            select: {
              authFactors: { select: { type: true, enabled: true } },
              identities: { select: { provider: true } },
            },
          },
        },
        where: { userId: { notIn: skipUserIds || [] } },
      },
    },
    where: { id: teamId },
  });

  if (!team.loginConfig) {
    return 0;
  }

  const { loginConfig, members } = team;

  const userIds = members.map(({ userId }) => userId);
  const sessions = await prisma.sessions.findMany({ where: { userId: { in: userIds } } }).then((sessions) =>
    sessions.map((session) => ({
      ...session,
      sess: session.sess as unknown as SessionData,
    })),
  );

  const sessionsByUserId = groupBy(sessions, 'userId');
  const sessionsToRevoke = new Set<string>();

  const allowedProviders = new Set<string>(loginConfig.allowedProviders);

  // SSO sessions store the provider as 'saml'/'oidc' and are always valid while SSO is active
  if (loginConfig.ssoEnabled && loginConfig.ssoProvider !== 'NONE') {
    allowedProviders.add(loginConfig.ssoProvider.toLowerCase());
  }

  // Revoke all user sessions that are logged in with a provider that is no longer allowed
  sessions.forEach((session) => {
    if (!isString(session.sess.provider) || !allowedProviders.has(session.sess.provider)) {
      sessionsToRevoke.add(session.sid);
    }
  });

  // Revoke user sessions for users that do not have a valid mfa factor
  if (loginConfig.requireMfa) {
    const allowedAuthFactors = new Set(loginConfig.allowedMfaMethods.map((provider) => `2fa-${provider}`));
    members
      .filter((teamMember) => !teamMember.user.authFactors.some((factor) => factor.enabled && allowedAuthFactors.has(factor.type)))
      .forEach((teamMember) => {
        (sessionsByUserId[teamMember.userId] || []).forEach((session) => sessionsToRevoke.add(session.sid));
      });
  }

  if (sessionsToRevoke.size > 0) {
    logger.info(`Revoking ${sessionsToRevoke.size} sessions for team ${teamId} that violate login configuration`);
    await prisma.sessions.deleteMany({ where: { sid: { in: Array.from(sessionsToRevoke) } } });
  }

  return sessionsToRevoke.size;
}

/**
 * Enforce the invariant that a team always retains at least one active ADMIN.
 *
 * Throws `NotAllowedError` when a member update would strip the last active admin of active-admin
 * status, leaving the team with zero active admins. `nextRole`/`nextStatus` are the values the
 * update will set; whichever is omitted is left unchanged (e.g. a role-only update keeps the
 * current status).
 *
 * The target's CURRENT state is read inside this transaction (not from a snapshot taken before the
 * transaction opened) so the decision is consistent with the OTHER-admins count — closing a TOCTOU
 * where a concurrent status change between a pre-read and the transaction could be missed. Must run
 * while holding the team row lock (`withTeamSeatLock`) so two concurrent "deactivate a different
 * admin" requests are serialized instead of each observing one remaining admin and both proceeding.
 */
async function assertTeamRetainsActiveAdmin(
  tx: Prisma.TransactionClient,
  { teamId, userId, nextRole, nextStatus }: { teamId: string; userId: string; nextRole?: Maybe<string>; nextStatus?: Maybe<string> },
): Promise<void> {
  const current = await tx.teamMember.findUnique({
    select: { role: true, status: true },
    where: { teamId_userId: { teamId, userId } },
  });
  if (!current) {
    return; // member not found — the update itself will surface the error
  }

  const isCurrentlyActiveAdmin = current.role === TEAM_MEMBER_ROLE_ADMIN && current.status === TEAM_MEMBER_STATUS_ACTIVE;
  const effectiveRole = nextRole ?? current.role;
  const effectiveStatus = nextStatus ?? current.status;
  const willBeActiveAdmin = effectiveRole === TEAM_MEMBER_ROLE_ADMIN && effectiveStatus === TEAM_MEMBER_STATUS_ACTIVE;

  // Only a transition OUT of active-admin can remove the team's last admin. Demoting/deactivating a
  // member who is not currently an active admin cannot reduce the active-admin count.
  if (!isCurrentlyActiveAdmin || willBeActiveAdmin) {
    return;
  }

  const otherActiveAdmins = await tx.teamMember.count({
    where: { teamId, role: TEAM_MEMBER_ROLE_ADMIN, status: TEAM_MEMBER_STATUS_ACTIVE, userId: { not: userId } },
  });
  if (otherActiveAdmins === 0) {
    throw new NotAllowedError('A team must have at least one active administrator');
  }
}

export async function updateTeamMemberRole({
  teamId,
  userId,
  runningUserId,
  data,
}: {
  teamId: string;
  userId: string;
  runningUserId: string;
  data: TeamMemberUpdateRequest;
}): Promise<{
  teamMember: TeamMember;
  previousMember: { role: string; features: string[]; email: string };
}> {
  const teamMember = await prisma.teamMember.findUniqueOrThrow({
    select: { role: true, status: true, features: true, user: { select: { email: true } } },
    where: { teamId_userId: { teamId, userId } },
  });

  // The team row lock serializes every membership write for the team, so the seat count and the
  // last-admin guard both observe a consistent state. The member is re-read under the lock: a status
  // change committed between the read above and the lock would otherwise let a seat be taken unchecked.
  // This function only changes role; status is left unchanged (nextStatus omitted), so the guard
  // derives the effective status from its own read.
  const updatedTeamMember = await withTeamSeatLock(teamId, async (tx) => {
    const current = await tx.teamMember.findUniqueOrThrow({
      select: { role: true, status: true },
      where: { teamId_userId: { teamId, userId } },
    });
    // Only a member who is not already using a seat needs one (e.g. BILLING → MEMBER). MEMBER → ADMIN
    // and features-only updates are seat-neutral and never hit the check.
    const nextRole = data.role ?? current.role;
    const needsSeat = isSeatConsumingMember({ role: nextRole, status: current.status }) && !isSeatConsumingMember(current);
    if (needsSeat) {
      await assertSeatAvailable(tx, { teamId, kind: 'ADD', excludeUserId: userId });
    }
    await assertTeamRetainsActiveAdmin(tx, { teamId, userId, nextRole: data.role });
    return tx.teamMember.update({
      select: SELECT_TEAM_MEMBER,
      where: { teamId_userId: { teamId, userId } },
      data: { ...TeamMemberUpdateRequestSchema.parse(data), updatedById: runningUserId },
    });
  });

  return {
    teamMember: TeamMemberSchema.parse(updatedTeamMember),
    previousMember: { role: teamMember.role, features: teamMember.features as string[], email: teamMember.user.email },
  };
}

/**
 * This function requires a status update and optionally a role update
 * These are combined because a user may want to re-activate a user and change their role at the same time (e.g. set to billing role)
 * This helps avoid taking a seat the admin did not intend to use
 */
export async function updateTeamMemberStatusAndRole({
  teamId,
  userId,
  runningUserId,
  status,
  role,
}: {
  teamId: string;
  userId: string;
  runningUserId: string;
  status: TeamMemberStatus;
  role?: Maybe<TeamMemberRole>;
}): Promise<{
  teamMember: TeamMember;
  previousMember: { role: string; status: string; email: string };
}> {
  const teamMember = await prisma.teamMember.findUniqueOrThrow({
    select: { role: true, status: true, user: { select: { email: true } } },
    where: { teamId_userId: { teamId, userId } },
  });

  const previousMember = { role: teamMember.role, status: teamMember.status, email: teamMember.user.email };

  // NOOP if status is not changing
  if (teamMember.status === status && (!role || teamMember.role === role)) {
    return {
      teamMember: await prisma.teamMember
        .findUniqueOrThrow({
          select: SELECT_TEAM_MEMBER,
          where: { teamId_userId: { teamId, userId } },
        })
        .then((member) => TeamMemberSchema.parse(member)),
      previousMember,
    };
  }

  const updatedTeamMember = await withTeamSeatLock(teamId, async (tx) => {
    // Re-read under the lock so the seat decision reflects any change that landed since the read above
    const current = await tx.teamMember.findUniqueOrThrow({
      select: { role: true, status: true },
      where: { teamId_userId: { teamId, userId } },
    });
    const nextRole = role || (current.role as TeamMemberRole);
    // Reactivating into a billable role takes a seat; deactivation and moves into BILLING never do, and
    // a member who already holds a seat keeps it (e.g. ACTIVE MEMBER → ACTIVE ADMIN).
    const needsSeat = isSeatConsumingMember({ role: nextRole, status }) && !isSeatConsumingMember(current);
    if (needsSeat) {
      await assertSeatAvailable(tx, { teamId, kind: 'ADD', excludeUserId: userId });
    }
    // Both role and status are set explicitly here, so the guard's effective end-state is fully
    // determined by the request (no dependency on the member's pre-transaction state).
    await assertTeamRetainsActiveAdmin(tx, { teamId, userId, nextRole, nextStatus: status });
    return tx.teamMember.update({
      select: SELECT_TEAM_MEMBER,
      where: { teamId_userId: { teamId, userId } },
      data: { status, role: nextRole, updatedById: runningUserId },
    });
  });

  return {
    teamMember: TeamMemberSchema.parse(updatedTeamMember),
    previousMember,
  };
}

export async function createBillingAccountIfNotExists({ teamId, customerId }: { teamId: string; customerId: string }) {
  const existingCustomer = await prisma.teamBillingAccount.findUnique({ where: { uniqueCustomer: { customerId, teamId } } });
  if (existingCustomer) {
    return existingCustomer;
  }
  return await prisma.teamBillingAccount.upsert({
    create: { teamId, customerId },
    update: { customerId },
    where: { teamId },
  });
}

export async function getTeamInvitations({ teamId }: { teamId: string }) {
  return await prisma.teamMemberInvitation
    .findMany({
      select: INVITE_SELECT,
      where: { teamId, expiresAt: { gte: addDays(new Date(), -TEAM_INVITE_EXPIRES_DAYS) } },
    })
    .then((invites) => TeamInviteUserFacingSchema.array().parse(invites));
}

export async function createTeamInvitation({
  teamId,
  runningUserId,
  request,
}: {
  teamId: string;
  runningUserId: string;
  request: TeamInvitationRequest;
}) {
  const { email, role } = request;

  // Everything runs under the team row lock so two concurrent invites cannot both take the last seat.
  return withTeamSeatLock(teamId, async (tx) => {
    // User is already part of a different team (for now we don't support this use-case)
    const existingTeamMemberCount = await tx.teamMember.count({
      where: { user: { email } },
    });

    if (existingTeamMemberCount > 0) {
      throw new UserFacingError(`User with email ${email} is already a member of another team.`);
    }

    const existingInvitationCount = await tx.teamMemberInvitation.count({
      where: { teamId, email, expiresAt: { gte: endOfDay(new Date()) } },
    });

    if (existingInvitationCount > 0) {
      throw new UserFacingError(
        `An invitation for ${email} already exists for this team. Revoke the existing invitation before creating a new one.`,
      );
    }

    // Clear stale invitations for this email before counting so the one being replaced does not hold
    // a seat against its own replacement; the delete rolls back with the transaction when no seat is free.
    await tx.teamMemberInvitation.deleteMany({
      where: { teamId, email },
    });

    if (isBillableRole(role)) {
      await assertSeatAvailable(tx, { teamId, kind: 'ADD' });
    }

    return tx.teamMemberInvitation.create({
      select: INVITE_SELECT,
      data: {
        teamId,
        email,
        createdById: runningUserId,
        updatedById: runningUserId,
        role,
        expiresAt: addDays(new Date(), TEAM_INVITE_EXPIRES_DAYS),
        features: request.features || ['ALL'],
        lastSentAt: new Date(),
      },
    });
  });
}

export async function updateTeamInvitation({
  id,
  teamId,
  expectedRole,
  request,
  runningUserId,
}: {
  id: string;
  teamId: string;
  /**
   * Role snapshot from the controller's authorization check. The UPDATE is gated on this value
   * so a concurrent role elevation between auth and write cannot be stamped by a caller who was
   * authorized against the stale role.
   */
  expectedRole: string;
  request: TeamInvitationUpdateRequest;
  runningUserId: string;
}) {
  return withTeamSeatLock(teamId, async (tx) => {
    const existingInvitation = await tx.teamMemberInvitation.findFirst({ select: { role: true, expiresAt: true }, where: { id, teamId } });
    if (!existingInvitation) {
      throw new NotFoundError(`No existing invitation found with id ${id}.`);
    }

    // Resending an expired invitation, or moving one into a billable role, reserves a seat again; an
    // unexpired billable invitation already holds its seat and is simply extended.
    const nextRole = request.role ?? existingInvitation.role;
    if (isBillableRole(nextRole) && !isSeatReservingInvitation(existingInvitation)) {
      await assertSeatAvailable(tx, { teamId, kind: 'ADD' });
    }

    // Atomic compare-and-set on role: if another admin changed the role since the controller read,
    // count will be 0 and we abort rather than applying a write authorized against a stale value.
    const result = await tx.teamMemberInvitation.updateMany({
      where: { id, teamId, role: expectedRole },
      data: {
        // Only write role/features if the caller provided an explicit value; otherwise leave them untouched.
        ...(request.role ? { role: request.role } : {}),
        ...(request.features ? { features: request.features } : {}),
        expiresAt: addDays(new Date(), TEAM_INVITE_EXPIRES_DAYS),
        lastSentAt: new Date(),
        updatedById: runningUserId,
      },
    });

    if (result.count === 0) {
      const stillExists = await tx.teamMemberInvitation.findFirst({ select: { id: true }, where: { teamId, id } });
      if (!stillExists) {
        throw new NotFoundError(`No existing invitation found with id ${id}.`);
      }
      throw new NotAllowedError('This invitation was modified by another admin. Refresh and try again.');
    }

    // Read-back after the compare-and-set. Using findFirst (not findFirstOrThrow) so a concurrent
    // cancelInvitation that deletes the row between our successful UPDATE and this SELECT does not
    // surface as a 500 — it becomes the same "modified concurrently" 403 as the role-mismatch path.
    const updated = await tx.teamMemberInvitation.findFirst({ select: INVITE_SELECT, where: { id } });
    if (!updated) {
      throw new NotAllowedError('This invitation was modified by another admin. Refresh and try again.');
    }
    return updated;
  });
}

export async function findTeamInvitationById({ id, teamId }: { id: string; teamId: string }) {
  const existingInvitation = await prisma.teamMemberInvitation.findFirst({
    select: { id: true, email: true, role: true, features: true, expiresAt: true, lastSentAt: true },
    where: { teamId, id },
  });

  if (!existingInvitation) {
    throw new NotFoundError(`No existing invitation found with id ${id}.`);
  }

  return existingInvitation;
}

export async function verifyTeamInvitation({
  user: userProfileSession,
  teamId,
  token,
}: {
  user: UserProfileSession;
  teamId: string;
  token: string;
}) {
  const user = await prisma.user.findUniqueOrThrow({
    select: {
      id: true,
      email: true,
      hasPasswordSet: true,
      authFactors: {
        select: {
          enabled: true,
          type: true,
        },
        where: { enabled: true, type: { not: 'email' } },
      },
      identities: {
        select: {
          provider: true,
        },
      },
    },
    where: { id: userProfileSession.id },
  });
  const existingInvitation = await prisma.teamMemberInvitation.findFirst({
    select: {
      ...INVITE_SELECT,
      team: {
        select: {
          id: true,
          name: true,
          loginConfig: {
            select: {
              allowedMfaMethods: true,
              allowedProviders: true,
              allowIdentityLinking: true,
              autoAddToTeam: true,
              domains: true,
              requireMfa: true,
              ssoProvider: true,
              ssoEnabled: true,
              ssoJitProvisioningEnabled: true,
            },
          },
        },
      },
    },
    where: { teamId, email: user.email, token, expiresAt: { gte: new Date() } },
  });

  if (!existingInvitation) {
    throw new NotFoundError(`Invitation Not Found.`);
  }

  return {
    ...existingInvitation,
    user,
    team: {
      ...existingInvitation.team,
      loginConfig: {
        // TeamLoginConfigSchema strips the SSO fields, but they are needed to know if SSO is a valid login method
        ...TeamLoginConfigSchema.parse(existingInvitation.team.loginConfig || {}),
        ssoEnabled: existingInvitation.team.loginConfig?.ssoEnabled ?? false,
        ssoProvider: existingInvitation.team.loginConfig?.ssoProvider ?? 'NONE',
      },
    },
  };
}

/**
 * Accepting from the dashboard. Login-time acceptance and SSO provisioning live in
 * `@jetstream/auth/server`; every path delegates to `addMemberFromInvitation` so the seat check
 * cannot be skipped by one of them.
 */
export async function acceptTeamInvitation({ user, teamId, token }: { user: UserProfileSession; teamId: string; token: string }): Promise<{
  email: string;
  role: string;
  features: string[];
}> {
  const existingInvitation = await verifyTeamInvitation({ user, teamId, token });

  await withTeamSeatLock(teamId, (tx) => addMemberFromInvitation(tx, { teamId, userId: user.id, invitation: existingInvitation }));

  return {
    email: existingInvitation.email,
    role: existingInvitation.role,
    features: existingInvitation.features as string[],
  };
}

export async function revokeTeamInvitation({
  id,
  teamId,
  expectedRole,
}: {
  id: string;
  teamId: string;
  /**
   * Role snapshot from the controller's authorization check; the DELETE is gated on this value
   * to prevent a concurrent role elevation from turning an authorized delete into an unauthorized one.
   */
  expectedRole: string;
}) {
  const result = await prisma.teamMemberInvitation.deleteMany({
    where: { id, teamId, role: expectedRole },
  });

  if (result.count === 0) {
    const stillExists = await prisma.teamMemberInvitation.findFirst({ select: { id: true }, where: { teamId, id } });
    if (!stillExists) {
      throw new NotFoundError(`No existing invitation found with id ${id}.`);
    }
    throw new NotAllowedError('This invitation was modified by another admin. Refresh and try again.');
  }
}

/**
 * SSO Configuration CRUD Functions
 */

/**
 * Minimal lookup used by the in-app expiration banner. Returns null when the team has no SAML
 * configuration, has SSO turned off, or the certificate expiration could not be parsed.
 */
export async function getSamlCertificateExpiration(teamId: string): Promise<{ configId: string; expiresAt: Date } | null> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      loginConfig: {
        select: {
          ssoEnabled: true,
          samlConfiguration: { select: { id: true, idpCertificateExpiresAt: true } },
        },
      },
    },
  });

  const samlConfiguration = team?.loginConfig.samlConfiguration;
  if (!team?.loginConfig.ssoEnabled || !samlConfiguration?.idpCertificateExpiresAt) {
    return null;
  }

  return { configId: samlConfiguration.id, expiresAt: samlConfiguration.idpCertificateExpiresAt };
}

export async function getSsoConfiguration(teamId: string): Promise<LoginConfigurationWithCallbacks> {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      id: true,
      loginConfig: {
        select: {
          id: true,
          ssoProvider: true,
          ssoEnabled: true,
          ssoJitProvisioningEnabled: true,
          ssoBypassEnabled: true,
          ssoBypassEnabledRoles: true,
          ssoRequireMfa: true,
          samlConfiguration: true,
          oidcConfiguration: true,
        },
      },
    },
  });

  if (!team) {
    throw new NotFoundError('Team not found');
  }

  const { callbackUrls } = resolveSamlIdentifiers(teamId);

  return LoginConfigurationWithCallbacksSchema.parse({
    ...team.loginConfig,
    // Add callback URLs for configuration
    callbackUrls,
  });
}

/**
 * Parse the expiration date from a base64-encoded X.509 certificate (no PEM headers).
 * Returns null if parsing fails so a bad cert doesn't block saving the config.
 */
function parseCertificateExpiresAt(certBase64: string): Date | null {
  try {
    const lines = certBase64.match(/.{1,64}/g) || [];
    const pem = `-----BEGIN CERTIFICATE-----\n${lines.join('\n')}\n-----END CERTIFICATE-----`;
    const cert = new X509Certificate(pem);
    return new Date(cert.validTo);
  } catch {
    return null;
  }
}

/**
 * Seed the reminder schedule for a newly saved certificate.
 *
 * Every threshold is already in the past for a certificate that has expired, so
 * `computeNextCertNotificationDate` returns null — correct when the cron advances an exhausted
 * schedule (null takes the configuration out of its query for good), but wrong as a seed, where it
 * would silently opt the team out of ever being told. Falling back to "due on the next run" gives an
 * expired certificate the same single catch-up notification the backfill migration gives
 * pre-existing configurations; the cron then advances it to null, so it still only sends once.
 */
function resolveCertNotificationSeed(expiresAt: Date, now = new Date()): Date {
  return computeNextCertNotificationDate(expiresAt, now) ?? now;
}

export async function createOrUpdateSamlConfiguration(teamId: string, userId: string, data: SamlConfigurationRequest) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      loginConfigId: true,
      loginConfig: {
        select: {
          samlConfiguration: true,
        },
      },
    },
  });

  if (!team) {
    throw new NotFoundError('Team not found');
  }

  const previousSamlConfig = team.loginConfig.samlConfiguration;
  const isNew = !previousSamlConfig;

  // Generate SP entity ID and ACS URL
  const { acsUrl, spEntityId: entityId } = resolveSamlIdentifiers(teamId);

  const samlData = {
    name: data.name,
    entityId,
    acsUrl,
    idpEntityId: data.idpEntityId,
    idpSsoUrl: data.idpSsoUrl,
    idpCertificate: data.idpCertificate,
    idpMetadataXml: data.idpMetadataXml,
    idpMetadataUrl: data.idpMetadataUrl ?? null,
    nameIdFormat: data.nameIdFormat || 'urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified',
    signRequests: data.signRequests ?? false,
    wantAssertionsSigned: data.wantAssertionsSigned ?? true,
    spCertificate: data.spCertificate,
    spPrivateKey: data.spPrivateKey,
    attributeMapping: data.attributeMapping,
  };

  if (samlData.idpCertificate) {
    // Strip headers and whitespace from certificate if present
    samlData.idpCertificate = samlData.idpCertificate
      .replace(/-----BEGIN CERTIFICATE-----/g, '')
      .replace(/-----END CERTIFICATE-----/g, '')
      .replace(/\s/g, '');
  }

  const idpCertificateExpiresAt = samlData.idpCertificate ? parseCertificateExpiresAt(samlData.idpCertificate) : null;

  // A new expiration date restarts the reminder schedule, so an admin who renews after the 7-day
  // warning still gets the full 30/14/7/3 sequence against the new date. Keying off the expiration
  // rather than the certificate value is deliberate: an unchanged expiration means the remaining
  // reminders are already scheduled for the right days, and re-seeding would both replay reminders
  // after any unrelated edit (renaming the config, tweaking attribute mapping) and risk re-sending a
  // threshold that already fired earlier the same day.
  const certificateExpirationChanged = previousSamlConfig?.idpCertificateExpiresAt?.getTime() !== idpCertificateExpiresAt?.getTime();
  const notificationSchedule = certificateExpirationChanged
    ? {
        nextCertNotificationDate: idpCertificateExpiresAt ? resolveCertNotificationSeed(idpCertificateExpiresAt) : null,
        lastCertNotificationAt: null,
      }
    : {};

  if (!isNew) {
    // Update existing
    await prisma.samlConfiguration.update({
      where: { loginConfigId: team.loginConfigId },
      data: { ...samlData, idpCertificateExpiresAt, ...notificationSchedule },
    });
  } else {
    // Create new
    await prisma.samlConfiguration.create({
      data: {
        ...samlData,
        idpCertificateExpiresAt,
        ...notificationSchedule,
        loginConfigId: team.loginConfigId,
      },
    });
  }

  // Update LoginConfiguration to set SAML as the provider
  await prisma.loginConfiguration.update({
    where: { id: team.loginConfigId },
    data: {
      ssoProvider: 'SAML',
      updatedById: userId,
    },
  });

  clearLoginConfigurationCacheItem(teamId);

  return { isNew, previous: previousSamlConfig, result: await getSsoConfiguration(teamId) };
}

export async function createOrUpdateOidcConfiguration(
  teamId: string,
  userId: string,
  // authorizationEndpoint, tokenEndpoint, and jwksUri are non-nullable columns resolved from OIDC
  // discovery by the controller, so they are required here even though they are optional on the wire request.
  data: OidcConfigurationRequest & { authorizationEndpoint: string; tokenEndpoint: string; jwksUri: string },
) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      loginConfigId: true,
      loginConfig: {
        select: {
          oidcConfiguration: true,
        },
      },
    },
  });

  if (!team) {
    throw new NotFoundError('Team not found');
  }

  const previousOidcConfig = team.loginConfig.oidcConfiguration;
  const isNew = !previousOidcConfig;

  const oidcData = {
    name: data.name,
    issuer: data.issuer,
    clientId: data.clientId,
    clientSecret: data.clientSecret ?? undefined,
    authorizationEndpoint: data.authorizationEndpoint,
    tokenEndpoint: data.tokenEndpoint,
    userinfoEndpoint: data.userinfoEndpoint,
    jwksUri: data.jwksUri,
    endSessionEndpoint: data.endSessionEndpoint,
    scopes: data.scopes || ['openid', 'email', 'profile'],
    responseType: 'code',
    attributeMapping: data.attributeMapping,
  };

  if (!isNew) {
    // Update existing
    await prisma.oidcConfiguration.update({
      where: { loginConfigId: team.loginConfigId },
      data: oidcData,
    });
  } else {
    if (!oidcData.clientSecret) {
      throw new UserFacingError('Client secret is required for new OIDC configuration');
    }
    // Create new
    await prisma.oidcConfiguration.create({
      data: {
        ...oidcData,
        clientSecret: oidcData.clientSecret,
        loginConfigId: team.loginConfigId,
      },
    });
  }

  // Update LoginConfiguration to set OIDC as the provider
  await prisma.loginConfiguration.update({
    where: { id: team.loginConfigId },
    data: {
      ssoProvider: 'OIDC',
      updatedById: userId,
    },
  });

  clearLoginConfigurationCacheItem(teamId);

  return { isNew, previous: previousOidcConfig, result: await getSsoConfiguration(teamId) };
}

export async function updateSsoSettings(
  teamId: string,
  userId: string,
  data: {
    ssoEnabled: boolean;
    ssoJitProvisioningEnabled: boolean;
    ssoBypassEnabled: boolean;
    ssoBypassEnabledRoles: TeamMemberRole[];
  },
) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      loginConfigId: true,
      loginConfig: {
        select: {
          ssoProvider: true,
          ssoEnabled: true,
          ssoJitProvisioningEnabled: true,
          ssoBypassEnabled: true,
          ssoBypassEnabledRoles: true,
          ssoRequireMfa: true,
          allowedProviders: true,
          samlConfiguration: { select: { id: true } },
          oidcConfiguration: { select: { id: true } },
        },
      },
    },
  });

  if (!team) {
    throw new NotFoundError('Team not found');
  }

  const previousSettings = {
    ssoEnabled: team.loginConfig.ssoEnabled,
    ssoJitProvisioningEnabled: team.loginConfig.ssoJitProvisioningEnabled,
    ssoBypassEnabled: team.loginConfig.ssoBypassEnabled,
    ssoBypassEnabledRoles: team.loginConfig.ssoBypassEnabledRoles as string[],
    ssoRequireMfa: team.loginConfig.ssoRequireMfa,
  };

  // Validate that a provider configuration exists before allowing SSO to be enabled
  if (data.ssoEnabled) {
    const { ssoProvider, samlConfiguration, oidcConfiguration } = team.loginConfig;
    if (ssoProvider === 'NONE') {
      throw new UserFacingError('Cannot enable SSO without first configuring an SSO provider (SAML or OIDC)');
    }
    if (ssoProvider === 'SAML' && !samlConfiguration) {
      throw new UserFacingError('Cannot enable SSO: SAML is selected as the provider but no SAML configuration exists');
    }
    if (ssoProvider === 'OIDC' && !oidcConfiguration) {
      throw new UserFacingError('Cannot enable SSO: OIDC is selected as the provider but no OIDC configuration exists');
    }
  }

  // Prevent disabling SSO when it is the only allowed login provider, otherwise the team would be locked out
  if (!data.ssoEnabled && team.loginConfig.ssoEnabled && team.loginConfig.allowedProviders.length === 0) {
    throw new UserFacingError('Cannot disable SSO because it is the only allowed login provider. Enable another login provider first.');
  }

  await prisma.loginConfiguration.update({
    where: { id: team.loginConfigId },
    data: {
      ssoEnabled: data.ssoEnabled,
      ssoJitProvisioningEnabled: data.ssoJitProvisioningEnabled,
      ssoBypassEnabled: data.ssoBypassEnabled,
      ssoBypassEnabledRoles: data.ssoBypassEnabledRoles,
      updatedById: userId,
    },
  });

  clearLoginConfigurationCacheItem(teamId);

  return { previousSettings, result: await getSsoConfiguration(teamId) };
}

export async function deleteSamlConfiguration(teamId: string, userId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      loginConfigId: true,
      loginConfig: {
        select: {
          ssoEnabled: true,
          allowedProviders: true,
          samlConfiguration: {
            select: { id: true, idpEntityId: true, idpCertificateExpiresAt: true },
          },
        },
      },
    },
  });

  if (!team) {
    throw new NotFoundError('Team not found');
  }

  // Prevent deleting the SSO configuration when it is the only allowed login provider, otherwise the team would be locked out
  if (team.loginConfig.ssoEnabled && team.loginConfig.allowedProviders.length === 0) {
    throw new UserFacingError(
      'Cannot delete the SSO configuration because SSO is the only allowed login provider. Enable another login provider first.',
    );
  }

  const deletedConfig = team.loginConfig.samlConfiguration;

  // Delete AuthIdentity records for this provider type for all users in the team
  // This prevents identity reuse if the team switches to a different SAML provider
  const teamMembers = await prisma.teamMember.findMany({
    where: { teamId },
    select: { userId: true },
  });
  const memberUserIds = teamMembers.map(({ userId }) => userId);

  let affectedIdentitiesCount = 0;
  if (memberUserIds.length > 0) {
    const result = await prisma.authIdentity.deleteMany({
      where: {
        userId: { in: memberUserIds },
        provider: 'saml',
      },
    });
    affectedIdentitiesCount = result.count;
  }

  await prisma.samlConfiguration.deleteMany({
    where: { loginConfigId: team.loginConfigId },
  });

  // Reset SSO provider to NONE
  await prisma.loginConfiguration.update({
    where: { id: team.loginConfigId },
    data: {
      ssoProvider: 'NONE',
      ssoEnabled: false,
      updatedById: userId,
    },
  });

  clearLoginConfigurationCacheItem(teamId);

  return { deletedConfig, affectedIdentitiesCount };
}

export async function deleteOidcConfiguration(teamId: string, userId: string) {
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    select: {
      loginConfigId: true,
      loginConfig: {
        select: {
          ssoEnabled: true,
          allowedProviders: true,
          oidcConfiguration: {
            select: { id: true, issuer: true, clientId: true },
          },
        },
      },
    },
  });

  if (!team) {
    throw new NotFoundError('Team not found');
  }

  // Prevent deleting the SSO configuration when it is the only allowed login provider, otherwise the team would be locked out
  if (team.loginConfig.ssoEnabled && team.loginConfig.allowedProviders.length === 0) {
    throw new UserFacingError(
      'Cannot delete the SSO configuration because SSO is the only allowed login provider. Enable another login provider first.',
    );
  }

  const deletedConfig = team.loginConfig.oidcConfiguration;

  // Delete AuthIdentity records for this provider type for all users in the team
  // This prevents identity reuse if the team switches to a different OIDC provider
  const teamMembers = await prisma.teamMember.findMany({
    where: { teamId },
    select: { userId: true },
  });
  const memberUserIds = teamMembers.map(({ userId }) => userId);

  let affectedIdentitiesCount = 0;
  if (memberUserIds.length > 0) {
    const result = await prisma.authIdentity.deleteMany({
      where: {
        userId: { in: memberUserIds },
        provider: 'oidc',
      },
    });
    affectedIdentitiesCount = result.count;
  }

  await prisma.oidcConfiguration.deleteMany({
    where: { loginConfigId: team.loginConfigId },
  });

  // Reset SSO provider to NONE
  await prisma.loginConfiguration.update({
    where: { id: team.loginConfigId },
    data: {
      ssoProvider: 'NONE',
      ssoEnabled: false,
      updatedById: userId,
    },
  });

  clearLoginConfigurationCacheItem(teamId);

  return { deletedConfig, affectedIdentitiesCount };
}

export const hasVerifiedDomain = async (teamId: string) => {
  return prisma.domainVerification
    .count({ where: { teamId, status: TeamVerificationStatusSchema.enum.VERIFIED } })
    .then((count) => count > 0);
};

export const saveDomainVerification = async (teamId: string, domain: string, verificationCode: string) => {
  const existing = await prisma.domainVerification.findUnique({ where: { domain } });
  if (existing) {
    if (existing.teamId !== teamId) {
      throw new UserFacingError('Domain is already claimed by another team');
    }
    return prisma.domainVerification
      .update({
        where: { domain },
        data: { verificationCode, status: TeamVerificationStatusSchema.enum.PENDING, verifiedAt: null },
      })
      .then((items) => DomainVerificationSchema.parse(items));
  }

  return prisma.domainVerification
    .create({
      data: { teamId, domain, verificationCode, status: TeamVerificationStatusSchema.enum.PENDING },
    })
    .then((items) => DomainVerificationSchema.parse(items));
};

export const getDomainVerification = async (teamId: string, domainId: string) => {
  const verification = await prisma.domainVerification.findUnique({
    where: { id: domainId, teamId },
  });

  if (!verification) {
    return null;
  }

  return DomainVerificationSchema.parse(verification);
};

export const verifyDomainVerification = async (teamId: string, domainId: string) => {
  return prisma
    .$transaction(async (tx) => {
      const verification = await tx.domainVerification.update({
        where: { id: domainId, teamId },
        data: { status: 'VERIFIED', verifiedAt: new Date() },
      });

      // Update login configuration with verified domains
      const domains = await tx.domainVerification
        .findMany({
          where: { teamId, status: TeamVerificationStatusSchema.enum.VERIFIED },
        })
        .then((items) => items.map((item) => item.domain));

      const team = await tx.team.findUnique({
        where: { id: teamId },
        select: {
          loginConfig: { select: { id: true, domains: true } },
        },
      });

      if (team?.loginConfig) {
        await tx.loginConfiguration.update({
          where: { id: team.loginConfig.id },
          data: { domains },
        });
      }
      return verification;
    })
    .then((items) => DomainVerificationSchema.parse(items));
};

export const deleteDomainVerification = async (teamId: string, domainId: string) => {
  return prisma.$transaction(async (tx) => {
    const record = await tx.domainVerification.findUnique({
      where: { id: domainId, teamId },
    });

    if (!record) {
      throw new NotFoundError('Domain verification record not found');
    }

    await tx.domainVerification.delete({
      where: { id: domainId, teamId },
    });

    // Update login configuration with verified domains
    const domains = await tx.domainVerification
      .findMany({
        where: { teamId, status: TeamVerificationStatusSchema.enum.VERIFIED },
      })
      .then((items) => items.map((item) => item.domain));

    const team = await tx.team.findUnique({
      where: { id: teamId },
      select: { loginConfig: { select: { id: true, domains: true } } },
    });

    if (team?.loginConfig) {
      await tx.loginConfiguration.update({
        where: { id: team.loginConfig.id },
        data: { domains },
      });
    }

    return DomainVerificationSchema.parse(record);
  });
};

/**
 * Look up the userId associated with a session. Used for audit logging before session deletion.
 */
export const getSessionUserId = async (sessionId: string): Promise<string | null> => {
  const session = await prisma.sessions.findUnique({
    where: { sid: sessionId },
    select: { userId: true },
  });
  return session?.userId ?? null;
};

export const getDomainVerifications = async (teamId: string) => {
  return prisma.domainVerification
    .findMany({
      where: { teamId },
      orderBy: { createdAt: 'desc' },
    })
    .then((items) => DomainVerificationSchema.array().parse(items));
};
