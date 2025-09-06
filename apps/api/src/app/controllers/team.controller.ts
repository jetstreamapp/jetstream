import { ENV, logger } from '@jetstream/api-config';
import * as authService from '@jetstream/auth/server';
import { getErrorMessage } from '@jetstream/shared/utils';
import {
  TEAM_MEMBER_STATUS_ACTIVE,
  TEAM_MEMBER_STATUS_INACTIVE,
  TeamInvitationRequestSchema,
  TeamInvitationUpdateRequestSchema,
  TeamLoginConfigRequestSchema,
  TeamMemberUpdateRequestSchema,
} from '@jetstream/types';
import { z } from 'zod';
import * as teamDbService from '../db/team.db';
import * as teamService from '../services/team.service';
import { sendJson } from '../utils/response.handlers';
import { createRoute } from '../utils/route.utils';

export const routeDefinition = {
  verifyInvitation: {
    controllerFn: () => verifyInvitation,
    validators: {
      hasSourceOrg: false,
      params: z.object({
        teamId: z.string().uuid(),
        token: z.string().uuid(),
      }),
    },
  },
  acceptInvitation: {
    controllerFn: () => acceptInvitation,
    validators: {
      hasSourceOrg: false,
      params: z.object({
        teamId: z.string().uuid(),
        token: z.string().uuid(),
      }),
    },
  },
  getTeam: {
    controllerFn: () => getTeam,
    validators: {
      hasSourceOrg: false,
    },
  },
  updateTeam: {
    controllerFn: () => updateTeam,
    validators: {
      hasSourceOrg: false,
      params: z.object({
        teamId: z.string().uuid(),
      }),
      body: z.object({
        name: z.string().trim().min(2).max(255),
      }),
    },
  },
  getUserSessions: {
    controllerFn: () => getUserSessions,
    validators: {
      hasSourceOrg: false,
      params: z.object({
        teamId: z.string().uuid(),
      }),
    },
  },
  getUserAuthActivity: {
    controllerFn: () => getUserAuthActivity,
    validators: {
      hasSourceOrg: false,
      params: z.object({
        teamId: z.string().uuid(),
      }),
    },
  },
  updateLoginConfiguration: {
    controllerFn: () => updateLoginConfiguration,
    validators: {
      hasSourceOrg: false,
      params: z.object({
        teamId: z.string().uuid(),
      }),
      body: TeamLoginConfigRequestSchema,
    },
  },
  updateTeamMember: {
    controllerFn: () => updateTeamMember,
    validators: {
      hasSourceOrg: false,
      params: z.object({
        teamId: z.string().uuid(),
        userId: z.string().uuid(),
      }),
      body: TeamMemberUpdateRequestSchema,
    },
  },
  updateTeamMemberStatus: {
    controllerFn: () => updateTeamMemberStatus,
    validators: {
      hasSourceOrg: false,
      params: z.object({
        teamId: z.string().uuid(),
        userId: z.string().uuid(),
      }),
      body: z.object({
        status: z.enum([TEAM_MEMBER_STATUS_ACTIVE, TEAM_MEMBER_STATUS_INACTIVE]),
      }),
    },
  },
  getInvitations: {
    controllerFn: () => getInvitations,
    validators: {
      hasSourceOrg: false,
      params: z.object({
        teamId: z.string().uuid(),
      }),
    },
  },
  createInvitation: {
    controllerFn: () => createInvitation,
    validators: {
      hasSourceOrg: false,
      params: z.object({
        teamId: z.string().uuid(),
      }),
      body: TeamInvitationRequestSchema,
    },
  },
  resendInvitation: {
    controllerFn: () => resendInvitation,
    validators: {
      hasSourceOrg: false,
      params: z.object({
        teamId: z.string().uuid(),
        id: z.string().uuid(),
      }),
      body: TeamInvitationUpdateRequestSchema,
    },
  },
  cancelInvitation: {
    controllerFn: () => cancelInvitation,
    validators: {
      hasSourceOrg: false,
      params: z.object({
        teamId: z.string().uuid(),
        id: z.string().uuid(),
      }),
    },
  },
};

const verifyInvitation = createRoute(routeDefinition.verifyInvitation.validators, async ({ user, params }, req, res) => {
  const { teamId, token } = params;

  teamDbService
    .verifyTeamInvitation({ teamId, token, user })
    .then((invitation) => {
      sendJson(res, { success: true, teamName: invitation.team.name });
    })
    .catch((error) => {
      logger.warn({ error: getErrorMessage(error), teamId, token, userId: user.id }, 'Error verifying team invitation');
      sendJson(res, { success: false });
    });
});

const acceptInvitation = createRoute(routeDefinition.acceptInvitation.validators, async ({ user, body, params, clearCookie }, req, res) => {
  const { teamId, token } = params;

  await teamService.acceptTeamInvitation({ user, teamId, token });

  const cookieConfig = authService.getCookieConfig(ENV.USE_SECURE_COOKIES);
  clearCookie(cookieConfig.redirectUrl.name, cookieConfig.redirectUrl.options);

  // ensure session is updated to include the teamMembership
  await authService.refreshSessionUser(req);

  sendJson(res, { success: true, redirectUrl: ENV.JETSTREAM_CLIENT_URL });
});

const getTeam = createRoute(routeDefinition.getTeam.validators, async ({ user }, req, res) => {
  const team = await teamDbService.findByUserId({ userId: user.id });
  sendJson(res, team);
});

const updateTeam = createRoute(routeDefinition.updateTeam.validators, async ({ params, body }, req, res) => {
  const { teamId } = params;
  const team = await teamDbService.updateTeam({ teamId, payload: body });
  sendJson(res, team);
});

const getUserSessions = createRoute(routeDefinition.getUserSessions.validators, async ({ params }, req, res) => {
  const { teamId } = params;
  const sessions = await authService.getTeamUserSessions(teamId);
  sendJson(res, sessions);
});

const getUserAuthActivity = createRoute(routeDefinition.getUserAuthActivity.validators, async ({ params }, req, res) => {
  const { teamId } = params;
  const authActivity = await authService.getTeamUserActivity(teamId);
  sendJson(res, authActivity);
});

const updateLoginConfiguration = createRoute(routeDefinition.updateLoginConfiguration.validators, async ({ params, body }, req, res) => {
  const { teamId } = params;
  const team = await teamDbService.updateLoginConfiguration({ teamId, loginConfiguration: body });
  sendJson(res, team);
});

const updateTeamMember = createRoute(routeDefinition.updateTeamMember.validators, async ({ params, body, user }, req, res) => {
  const { teamId, userId } = params;

  const existingRole = user.teamMembership?.role;

  // TODO: we may want to allow a user to change their own role in some cases (E.g. ADMIN->BILLING when there are multiple admins)
  if (body.role && body.role !== existingRole && user.id === userId) {
    throw new Error('You cannot change your own role');
  }
  const team = await teamService.updateTeamMember({ teamId, userId, data: body, runningUserId: user.id });
  sendJson(res, team);
});

const updateTeamMemberStatus = createRoute(routeDefinition.updateTeamMemberStatus.validators, async ({ params, body, user }, req, res) => {
  const { teamId, userId } = params;
  const team = await teamService.updateTeamMemberStatus({ teamId, userId, status: body.status, runningUserId: user.id });
  sendJson(res, team);
});

const getInvitations = createRoute(routeDefinition.getInvitations.validators, async ({ params }, req, res) => {
  const { teamId } = params;
  const invitations = await teamDbService.getTeamInvitations({ teamId });
  sendJson(res, invitations);
});

const createInvitation = createRoute(routeDefinition.createInvitation.validators, async ({ user, params, body }, req, res) => {
  const { teamId } = params;
  const invitations = await teamService.createInvitation({
    runningUserId: user.id,
    teamId,
    request: body,
  });
  sendJson(res, invitations);
});

const resendInvitation = createRoute(routeDefinition.resendInvitation.validators, async ({ params, body }, req, res) => {
  const { teamId, id } = params;
  const invitations = await teamService.resendInvitation({
    teamId,
    invitationId: id,
    request: body,
  });
  sendJson(res, invitations);
});

const cancelInvitation = createRoute(routeDefinition.cancelInvitation.validators, async ({ params }, req, res) => {
  const { teamId, id } = params;
  await teamDbService.revokeTeamInvitation({ id, teamId });
  const invitations = await teamDbService.getTeamInvitations({ teamId });
  sendJson(res, invitations);
});
