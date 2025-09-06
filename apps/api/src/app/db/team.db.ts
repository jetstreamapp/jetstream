/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { prisma } from '@jetstream/api-config';
import { clearLoginConfigurationCacheItem } from '@jetstream/auth/server';
import { UserProfileSession } from '@jetstream/auth/types';
import { Prisma } from '@jetstream/prisma';
import {
  BILLABLE_ROLES,
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
import { isString } from 'lodash';
import { NotFoundError, UserFacingError } from '../utils/error-handler';

export const TEAM_INVITE_EXPIRES_DAYS = 14;

const INVITE_SELECT = Prisma.validator<Prisma.TeamMemberInvitationSelect>()({
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
});

const SELECT_TEAM_MEMBER = Prisma.validator<Prisma.TeamMemberSelect>()({
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
});

const SELECT_WITH_RELATED = Prisma.validator<Prisma.TeamSelect>()({
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
  },
  invitations: {
    select: INVITE_SELECT,
    where: {
      expiresAt: { gte: addDays(new Date(), -TEAM_INVITE_EXPIRES_DAYS) }, // Only include active and recently expired invitations
    },
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
});

export const findById = async ({ teamId }: { teamId: string }) => {
  return await prisma.team
    .findFirstOrThrow({
      select: SELECT_WITH_RELATED,
      where: { id: teamId },
    })
    .then((team) => team && TeamUserFacingSchema.parse(team));
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
      team.members = team.members.toSorted((a, b) => {
        if (a.userId === userId) return -1; // Move current user to the top
        if (b.userId === userId) return 1; // Move current user to the top
        return a.user.email.localeCompare(b.user.name);
      });
      return team;
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
        team: { status: TeamStatusSchema.Enum.ACTIVE },
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
          },
        },
        loginConfig: {
          create: loginConfiguration,
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
        },
      },
      entitlements: {
        create: {},
      },
      loginConfig: {
        create: {},
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

export const updateTeam = async ({ teamId, payload }: { teamId: string; payload: { name: string } }) => {
  return await prisma.team
    .update({
      select: SELECT_WITH_RELATED,
      where: { id: teamId },
      data: { name: payload.name },
    })
    .then((team) => team && TeamUserFacingSchema.parse(team));
};

export const updateLoginConfiguration = async ({
  teamId,
  loginConfiguration,
}: {
  teamId: string;
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
      },
    });
  }

  clearLoginConfigurationCacheItem(team.id);

  return findById({ teamId: team.id });
};

export async function updateTeamMemberRole({
  teamId,
  userId,
  data,
}: {
  teamId: string;
  userId: string;
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
        data: TeamMemberUpdateRequestSchema.parse(data),
      })
      .then((member) => TeamMemberSchema.parse(member)),
    isBillableAction: BILLABLE_ROLES.has(teamMember.role),
  };
}

export async function updateTeamMemberStatus({
  teamId,
  userId,
  status,
}: {
  teamId: string;
  userId: string;
  status: TeamMemberStatus;
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
  if (teamMember.status === status) {
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

  // If this consumes a new user license, ensure this is allowed
  if (status === 'ACTIVE' && BILLABLE_ROLES.has(teamMember.role)) {
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
        data: { status },
      })
      .then((member) => TeamMemberSchema.parse(member)),
    isBillableAction: BILLABLE_ROLES.has(teamMember.role),
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
  createdByUserId,
  request,
}: {
  teamId: string;
  createdByUserId: string;
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
      `An invitation for ${request.email} already exists for this team. Revoke the existing invitation before creating a new one.`
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
        createdById: createdByUserId,
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

  if (team.billingStatus === TeamBillingStatusSchema.Enum.PAST_DUE) {
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

export async function updateTeamInvitation({ id, teamId, request }: { id: string; teamId: string; request: TeamInvitationUpdateRequest }) {
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
    },
  });
}

export async function verifyTeamInvitation({ user, teamId, token }: { user: UserProfileSession; teamId: string; token: string }) {
  const existingInvitation = await prisma.teamMemberInvitation.findFirst({
    select: INVITE_SELECT,
    where: { teamId, email: user.email, token, expiresAt: { gte: new Date() } },
  });

  if (!existingInvitation) {
    throw new NotFoundError(`Invitation Not Found.`);
  }

  return existingInvitation;
}

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
