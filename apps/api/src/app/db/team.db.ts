import { logger, prisma } from '@jetstream/api-config';
import { clearLoginConfigurationCacheItem } from '@jetstream/auth/server';
import { SessionData, UserProfileSession } from '@jetstream/auth/types';
import { Prisma } from '@jetstream/prisma';
import {
  BILLABLE_ROLES,
  Maybe,
  TEAM_MEMBER_ROLE_ADMIN,
  TEAM_MEMBER_ROLE_BILLING,
  TEAM_MEMBER_STATUS_ACTIVE,
  TeamBillingStatusSchema,
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
} from '@jetstream/types';
import { addDays, endOfDay } from 'date-fns';
import { groupBy, isString } from 'lodash';
import { NotFoundError, UserFacingError } from '../utils/error-handler';

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

const SELECT_WITH_RELATED = {
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
    },
  },
  members: {
    select: SELECT_TEAM_MEMBER,
    orderBy: { user: { name: 'asc' } },
  },
  invitations: {
    select: INVITE_SELECT,
  },
  loginConfig: {
    select: {
      allowedMfaMethods: true,
      allowedProviders: true,
      allowIdentityLinking: true,
      autoAddToTeam: true,
      domains: true,
      requireMfa: true,
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

function sortTeamMembers(members: TeamMember[], runningUserId: string) {
  members.sort((a, b) => {
    if (a.userId === runningUserId) return -1; // Move current user to the top
    if (b.userId === runningUserId) return 1; // Move current user to the top
    return a.user.name.localeCompare(b.user.name);
  });
}

export const findById = async ({ teamId, runningUserId }: { teamId: string; runningUserId?: string }) => {
  return await prisma.team
    .findFirstOrThrow({
      select: SELECT_WITH_RELATED,
      where: { id: teamId },
    })
    .then((team) => team && TeamUserFacingSchema.parse(team))
    .then((team) => {
      if (runningUserId) {
        sortTeamMembers(team.members, runningUserId);
      }
      return team;
    });
};

export const findByIdWithBillingInfo_UNSAFE = async ({ teamId }: { teamId: string }) => {
  return await prisma.team.findFirstOrThrow({
    select: {
      id: true,
      billingStatus: true,
      billingAccount: {
        select: {
          manualBilling: true,
          licenseCountLimit: true,
          customerId: true,
        },
      },
      members: {
        select: {
          role: true,
          status: true,
          userId: true,
        },
      },
    },
    where: { id: teamId },
  });
};

export const findByUserId = async ({ userId }: { userId: string }) => {
  return await prisma.team
    .findFirstOrThrow({
      select: SELECT_WITH_RELATED,
      where: {
        members: { some: { userId, role: { in: [TEAM_MEMBER_ROLE_ADMIN, TEAM_MEMBER_ROLE_BILLING] } } },
      },
    })
    .then((team) => team && TeamUserFacingSchema.parse(team))
    .then((team) => {
      sortTeamMembers(team.members, userId);
      return team;
    });
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
      select: SELECT_WITH_RELATED,
      data: {
        name,
        status,
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
          },
        },
      },
    })
    .then((team) => team && TeamUserFacingSchema.parse(team));

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
      select: SELECT_WITH_RELATED,
      where: { id: teamId },
      data: { name: payload.name, updatedById: runningUserId },
    })
    .then((team) => TeamUserFacingSchema.parse(team))
    .then((team) => {
      sortTeamMembers(team.members, runningUserId);
      return team;
    });
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

  // TODO: this is not yet implemented on UI
  // const domains = loginConfiguration.autoAddToTeam ? loginConfiguration.domains : [];

  // if (domains.length > 0) {
  //   const domainAlreadyInUse = await prisma.loginConfiguration.count({
  //     where: {
  //       OR: [{ team: null }, { team: { NOT: { id: team.id } } }],
  //       domains: {
  //         hasSome: domains,
  //       },
  //     },
  //   });
  //   if (domainAlreadyInUse > 0) {
  //     throw new UserFacingError(`One or more domains you specified is already in use, contact support for assistance.`);
  //   }
  // }

  if (!team.loginConfigId) {
    await prisma.loginConfiguration.create({
      data: {
        allowedMfaMethods: loginConfiguration.allowedMfaMethods,
        allowedProviders: loginConfiguration.allowedProviders,
        allowIdentityLinking: loginConfiguration.allowIdentityLinking,
        requireMfa: loginConfiguration.requireMfa,
        // TODO: not MVP, ignore these attributes for now
        // autoAddToTeam: loginConfiguration.autoAddToTeam,
        // domains,
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
        // autoAddToTeam: loginConfiguration.autoAddToTeam,
        // domains,
        updatedById: runningUserId,
      },
    });
  }

  clearLoginConfigurationCacheItem(team.id);

  return findById({ teamId: team.id, runningUserId });
};

export async function revokeSessionThatViolateLoginConfiguration({ teamId, skipUserIds }: { teamId: string; skipUserIds?: string[] }) {
  const team = await prisma.team.findFirstOrThrow({
    select: {
      loginConfig: {
        select: {
          allowedMfaMethods: true,
          allowedProviders: true,
          requireMfa: true,
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
    return;
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

  const allowedProviders = new Set(loginConfig.allowedProviders);

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
  /**
   * Indicates if billing needs to be updated due to this action
   */
  isBillableAction: boolean;
}> {
  const teamMember = await prisma.teamMember.findUniqueOrThrow({
    select: { role: true, status: true },
    where: { teamId_userId: { teamId, userId } },
  });

  // If this consumes a new user license, ensure this is allowed
  if (teamMember.role !== data.role && teamMember.status === 'ACTIVE' && BILLABLE_ROLES.has(data.role || teamMember.role)) {
    const { canAdd, reason } = await canAddBillableMember({ teamIdOrTeam: teamId });
    if (!canAdd) {
      throw new UserFacingError(reason);
    }
  }

  return {
    teamMember: await prisma.teamMember
      .update({
        select: SELECT_TEAM_MEMBER,
        where: { teamId_userId: { teamId, userId } },
        data: { ...TeamMemberUpdateRequestSchema.parse(data), updatedById: runningUserId },
      })
      .then((member) => TeamMemberSchema.parse(member)),
    isBillableAction: BILLABLE_ROLES.has(teamMember.role),
  };
}

/**
 * This function requires a status update and optionally a role update
 * These are combined because a user may want to re-activate a user and change their role at the same time (e.g. set to billing role)
 * This helps avoid unwanted billable changes
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
  /**
   * Indicates if billing needs to be updated due to this action
   */
  isBillableAction: boolean;
}> {
  const teamMember = await prisma.teamMember.findUniqueOrThrow({
    select: { role: true, status: true },
    where: { teamId_userId: { teamId, userId } },
  });

  // NOOP if status is not changing
  if (teamMember.status === status && (!role || teamMember.role === role)) {
    return {
      teamMember: await prisma.teamMember
        .findUniqueOrThrow({
          select: SELECT_TEAM_MEMBER,
          where: { teamId_userId: { teamId, userId } },
        })
        .then((member) => TeamMemberSchema.parse(member)),
      isBillableAction: false,
    };
  }

  // ensure role is set if not provided
  role = role || (teamMember.role as TeamMemberRole);

  // If this consumes a new user license, ensure this is allowed
  if (status === 'ACTIVE' && BILLABLE_ROLES.has(role)) {
    const { canAdd, reason } = await canAddBillableMember({ teamIdOrTeam: teamId });
    if (!canAdd) {
      throw new UserFacingError(reason);
    }
  }

  return {
    teamMember: await prisma.teamMember
      .update({
        select: SELECT_TEAM_MEMBER,
        where: { teamId_userId: { teamId, userId } },
        data: { status, role, updatedById: runningUserId },
      })
      .then((member) => TeamMemberSchema.parse(member)),
    isBillableAction: BILLABLE_ROLES.has(role),
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
  // User is already part of a different team (for now we don't support this use-case)
  const existingTeamMemberCount = await prisma.teamMember.count({
    where: { user: { email: request.email } },
  });

  if (existingTeamMemberCount > 0) {
    throw new UserFacingError(`User with email ${request.email} is already a member of another team.`);
  }

  const existingInvitationCount = await prisma.teamMemberInvitation.count({
    where: { teamId, email: request.email, expiresAt: { gte: endOfDay(new Date()) } },
  });

  if (existingInvitationCount > 0) {
    throw new UserFacingError(
      `An invitation for ${request.email} already exists for this team. Revoke the existing invitation before creating a new one.`,
    );
  }

  if (BILLABLE_ROLES.has(request.role)) {
    const { canAdd, reason } = await canAddBillableMember({ teamIdOrTeam: teamId });
    if (!canAdd) {
      throw new UserFacingError(reason);
    }
  }

  const [_, invitation] = await prisma.$transaction([
    prisma.teamMemberInvitation.deleteMany({
      where: { teamId, email: request.email },
    }),
    prisma.teamMemberInvitation.create({
      select: INVITE_SELECT,
      data: {
        teamId,
        email: request.email,
        createdById: runningUserId,
        updatedById: runningUserId,
        role: request.role,
        expiresAt: addDays(new Date(), TEAM_INVITE_EXPIRES_DAYS),
        features: request.features || ['ALL'],
        lastSentAt: new Date(),
      },
    }),
  ]);

  return invitation;
}

export async function canAddBillableMember({
  teamIdOrTeam,
}: {
  teamIdOrTeam: string | Awaited<ReturnType<typeof findByIdWithBillingInfo_UNSAFE>>;
}): Promise<{ canAdd: true; reason?: string } | { canAdd: false; reason: string }> {
  const team = isString(teamIdOrTeam) ? await findByIdWithBillingInfo_UNSAFE({ teamId: teamIdOrTeam }) : teamIdOrTeam;
  const teamId = team.id;

  if (team.billingStatus === TeamBillingStatusSchema.enum.PAST_DUE) {
    return {
      canAdd: false,
      reason: `Your account is past-due. New users cannot be added, contact support for assistance.`,
    };
  }

  if (team.billingAccount && team.billingAccount.licenseCountLimit !== null) {
    const licenseCountLimit = team.billingAccount.licenseCountLimit;
    const existingBillableMemberCount = await prisma.teamMember.count({
      where: { teamId, status: TEAM_MEMBER_STATUS_ACTIVE, role: { in: Array.from(BILLABLE_ROLES) } },
    });
    const existingBillableInvitationCount = await prisma.teamMemberInvitation.count({
      where: { teamId, role: { in: Array.from(BILLABLE_ROLES) } },
    });
    if (existingBillableMemberCount + existingBillableInvitationCount >= licenseCountLimit) {
      return {
        canAdd: false,
        reason: `You don't have any available licensed to assign. Please purchase more licenses or contact support for assistance.`,
      };
    }
  }
  return { canAdd: true };
}

export async function updateTeamInvitation({
  id,
  teamId,
  request,
  runningUserId,
}: {
  id: string;
  teamId: string;
  request: TeamInvitationUpdateRequest;
  runningUserId: string;
}) {
  const existingInvitation = await prisma.teamMemberInvitation.findFirst({
    select: { id: true, role: true, features: true, expiresAt: true, lastSentAt: true },
    where: { teamId, id },
  });

  if (!existingInvitation) {
    throw new NotFoundError(`No existing invitation found with id ${id}.`);
  }

  return await prisma.teamMemberInvitation.update({
    select: INVITE_SELECT,
    where: { id },
    data: {
      role: request.role || existingInvitation.role,
      expiresAt: addDays(new Date(), TEAM_INVITE_EXPIRES_DAYS),
      features: request.features || existingInvitation.features,
      lastSentAt: new Date(),
      updatedById: runningUserId,
    },
  });
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
      loginConfig: TeamLoginConfigSchema.parse(existingInvitation.team.loginConfig || {}),
    },
  };
}

/**
 * NOTE: there is also a path in auth.db.service - ideally we combine to remove code duplication
 */
export async function acceptTeamInvitation({ user, teamId, token }: { user: UserProfileSession; teamId: string; token: string }): Promise<{
  /**
   * Indicates if billing needs to be updated due to this action
   */
  isBillableAction: boolean;
}> {
  const existingInvitation = await verifyTeamInvitation({ user, teamId, token });

  await prisma.$transaction([
    prisma.teamMemberInvitation.delete({
      where: { id: existingInvitation.id },
    }),
    prisma.teamMember.create({
      select: { role: true, status: true, teamId: true, userId: true },
      data: {
        teamId,
        userId: user.id,
        role: existingInvitation.role,
        status: TEAM_MEMBER_STATUS_ACTIVE,
        features: existingInvitation.features,
        createdById: user.id,
        updatedById: user.id,
      },
    }),
  ]);

  return { isBillableAction: BILLABLE_ROLES.has(existingInvitation.role) };
}

export async function revokeTeamInvitation({ id, teamId }: { id: string; teamId: string }) {
  const existingInvitation = await prisma.teamMemberInvitation.findFirst({
    select: { id: true, role: true, features: true, expiresAt: true, lastSentAt: true },
    where: { teamId, id },
  });

  if (!existingInvitation) {
    throw new NotFoundError(`No existing invitation found with id ${id}.`);
  }

  await prisma.teamMemberInvitation.delete({
    where: { id },
  });
}
