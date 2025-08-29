/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { prisma } from '@jetstream/api-config';
import { clearLoginConfigurationCacheItem } from '@jetstream/auth/server';
import { UserProfileSession } from '@jetstream/auth/types';
import { Prisma } from '@jetstream/prisma';
import {
  TEAM_MEMBER_ROLE_ADMIN,
  TEAM_MEMBER_ROLE_BILLING,
  TEAM_MEMBER_STATUS_ACTIVE,
  TeamEntitlementSchema,
  TeamInvitationRequest,
  TeamInvitationUpdateRequest,
  TeamInviteUserFacingSchema,
  TeamLoginConfig,
  TeamLoginConfigRequest,
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

export const checkTeamRole = async ({ teamId, userId, roles }: { teamId: string; userId: string; roles: TeamMemberRole[] }) => {
  return prisma.teamMember
    .count({
      where: { teamId, team: { status: TeamStatusSchema.Enum.ACTIVE }, userId, role: { in: roles }, status: TEAM_MEMBER_STATUS_ACTIVE },
    })
    .then((count) => count > 0);
};

export const fetchEntitlements = async ({ teamId }: { teamId: string }) => {
  return prisma.teamEntitlement
    .findFirst({
      where: { teamId },
    })
    .then((entitlements) => TeamEntitlementSchema.parse(entitlements || {}));
};

export const fetchSubscriptions = async ({ teamId }: { teamId: string }) => {
  return prisma.teamSubscription
    .findMany({
      where: { teamId },
    })
    .then((records) => TeamSubscriptionSchema.array().parse(records));
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

export const updatePendingTeamToActive = async ({ teamId }: { teamId: string }) => {
  return await prisma.team
    .update({
      select: SELECT_WITH_RELATED,
      where: { id: teamId },
      data: { status: TeamStatusSchema.Enum.ACTIVE },
    })
    .then((team) => team && TeamUserFacingSchema.parse(team));
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

export const deletePendingTeam = async ({ teamId }: { teamId: string }) => {
  await prisma.team.delete({
    where: { id: teamId, status: TeamStatusSchema.Enum.PENDING },
  });
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

  const domains = loginConfiguration.autoAddToTeam ? loginConfiguration.domains : [];

  if (domains.length > 0) {
    const domainAlreadyInUse = await prisma.loginConfiguration.count({
      where: {
        OR: [{ team: null }, { team: { NOT: { id: team.id } } }],
        domains: {
          hasSome: domains,
        },
      },
    });
    if (domainAlreadyInUse > 0) {
      throw new UserFacingError(`One or more domains you specified is already in use, contact support for assistance.`);
    }
  }

  if (!team.loginConfigId) {
    await prisma.loginConfiguration.create({
      data: {
        allowedMfaMethods: loginConfiguration.allowedMfaMethods,
        allowedProviders: loginConfiguration.allowedProviders,
        allowIdentityLinking: loginConfiguration.allowIdentityLinking,
        requireMfa: loginConfiguration.requireMfa,
        autoAddToTeam: loginConfiguration.autoAddToTeam,
        domains,
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
        autoAddToTeam: loginConfiguration.autoAddToTeam,
        domains,
      },
    });
  }

  clearLoginConfigurationCacheItem(team.id);

  return findById({ teamId: team.id });
};

export async function updateTeamMemberRole({ teamId, userId, data }: { teamId: string; userId: string; data: TeamMemberUpdateRequest }) {
  return await prisma.teamMember
    .update({
      select: SELECT_TEAM_MEMBER,
      where: { teamId_userId: { teamId, userId } },
      data: TeamMemberUpdateRequestSchema.parse(data),
    })
    .then((member) => TeamMemberSchema.parse(member));
}

export async function updateTeamMemberStatus({ teamId, userId, status }: { teamId: string; userId: string; status: TeamMemberStatus }) {
  return await prisma.teamMember
    .update({
      select: SELECT_TEAM_MEMBER,
      where: { teamId_userId: { teamId, userId } },
      data: { status },
    })
    .then((member) => TeamMemberSchema.parse(member));
}

export async function createBillingAccountIfNotExists({ teamId, customerId }: { teamId: string; customerId: string }) {
  const existingCustomer = await prisma.teamBillingAccount.findUnique({ where: { uniqueCustomer: { customerId, teamId } } });
  if (existingCustomer) {
    return existingCustomer;
  }
  return await prisma.teamBillingAccount.create({
    data: { customerId, teamId },
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
    throw new Error(`User with email ${request.email} is already a member of a team.`);
  }

  const existingInvitationCount = await prisma.teamMemberInvitation.count({
    where: { teamId, email: request.email, expiresAt: { gte: endOfDay(new Date()) } },
  });

  if (existingInvitationCount > 0) {
    throw new Error(
      `An invitation for ${request.email} already exists for this team. Revoke the existing invitation before creating a new one.`
    );
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

export async function acceptTeamInvitation({ user, teamId, token }: { user: UserProfileSession; teamId: string; token: string }) {
  const existingInvitation = await verifyTeamInvitation({ user, teamId, token });

  const [_, teamMembership] = await prisma.$transaction([
    prisma.teamMemberInvitation.delete({
      where: { id: existingInvitation.id },
    }),
    prisma.teamMember.create({
      select: {
        features: true,
        role: true,
        status: true,
        teamId: true,
        userId: true,
      },
      data: {
        teamId,
        userId: user.id,
        role: existingInvitation.role,
        status: TEAM_MEMBER_STATUS_ACTIVE,
        features: existingInvitation.features,
      },
    }),
  ]);

  return teamMembership;
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
