/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { prisma } from '@jetstream/api-config';
import { UserProfileSession } from '@jetstream/auth/types';
import { Prisma } from '@jetstream/prisma';
import {
  TeamInvitationRequest,
  TeamInvitationUpdateRequest,
  TeamInviteUserFacingSchema,
  TeamLoginConfig,
  TeamLoginConfigRequest,
  TeamUserFacingSchema,
} from '@jetstream/types';
import { addDays, endOfDay } from 'date-fns';
import { NotFoundError } from '../utils/error-handler';

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

const SELECT_WITH_RELATED = Prisma.validator<Prisma.TeamSelect>()({
  id: true,
  name: true,
  loginConfigId: true,
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
  teamBillingAccount: {
    select: {
      customerId: true,
    },
  },
  members: {
    select: {
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
    },
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
        members: { some: { userId, role: 'ADMIN' } },
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

export const isTeamAdministrator = async ({ teamId, userId }: { teamId: string; userId: string }) => {
  return prisma.teamMember
    .count({
      where: { teamId, userId, role: 'ADMIN' },
    })
    .then((count) => count > 0);
};

export const createTeam = async ({
  name,
  userId,
  loginConfiguration,
}: {
  name: string;
  userId: string;
  loginConfiguration: TeamLoginConfig;
}) => {
  // ensure user is not part of another team
  const existingTeam = await prisma.teamMember.findFirst({
    where: { userId, team: { members: { some: { userId } } } },
  });

  if (existingTeam) {
    throw new Error(`User with ID ${userId} is already a member of another team.`);
  }

  const team = await prisma.team.create({
    select: SELECT_WITH_RELATED,
    data: {
      name,
      members: {
        create: {
          userId,
          role: 'ADMIN',
          status: 'ACTIVE',
        },
      },
      loginConfig: {
        create: loginConfiguration,
      },
    },
  });

  return team;
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

  if (!team.loginConfigId) {
    await prisma.loginConfiguration.create({
      data: {
        allowedMfaMethods: loginConfiguration.allowedMfaMethods,
        allowedProviders: loginConfiguration.allowedProviders,
        allowIdentityLinking: loginConfiguration.allowIdentityLinking,
        requireMfa: loginConfiguration.requireMfa,
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
      },
    });
  }

  return findById({ teamId: team.id });
};

export const getTeamMemberDetails = async ({ teamId, userId }: { teamId: string; userId: string }) => {
  prisma.teamMember.findFirstOrThrow({
    where: { userId, teamId },
    select: {
      user: {
        select: {
          id: true,
          email: true,
          name: true,
          lastLoggedIn: true,
          emailVerified: true,
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
          passwordUpdatedAt: true,
          authFactors: {
            select: {
              enabled: true,
              type: true,
            },
          },
        },
      },
      userId: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return await prisma.team
    .findFirstOrThrow({
      select: SELECT_WITH_RELATED,
      where: { id: teamId },
    })
    .then((team) => team && TeamUserFacingSchema.parse(team));
};

export async function createTeamBillingAccountIfNotExists({ teamId, customerId }: { teamId: string; customerId: string }) {
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
    prisma.teamMemberInvitation.delete({
      where: { uniqueTeamEmail: { teamId, email: request.email } },
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

  await prisma.$transaction([
    prisma.teamMemberInvitation.delete({
      where: { id: existingInvitation.id },
    }),
    prisma.teamMember.create({
      data: {
        teamId,
        userId: user.id,
        role: existingInvitation.role,
        status: 'ACTIVE',
        features: existingInvitation.features,
      },
    }),
  ]);
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
