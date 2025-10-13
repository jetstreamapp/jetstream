import { ENV, logger } from '@jetstream/api-config';
import * as authService from '@jetstream/auth/server';
import { getErrorMessage } from '@jetstream/shared/utils';
import {
  TeamInvitationRequestSchema,
  TeamInvitationUpdateRequestSchema,
  TeamLoginConfigRequestSchema,
  TeamMemberStatusUpdateRequestSchema,
  TeamMemberUpdateRequestSchema,
} from '@jetstream/types';
import { z } from 'zod';
import * as teamService from '../services/team.service';
import { sendJson } from '../utils/response.handlers';
import { createRoute } from '../utils/route.utils';

export const routeDefinition = {
  verifyInvitation: {
    controllerFn: () => verifyInvitation,
    responseType: z.object({ success: z.boolean(), inviteVerification: z.object({ email: z.string().email() }).nullish() }),
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
      params: z.object({
        teamId: z.uuid(),
        token: z.uuid(),
      }),
    },
  },
  acceptInvitation: {
    controllerFn: () => acceptInvitation,
    responseType: z.object({ success: z.boolean(), redirectUrl: z.string().url().nullish() }),
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
      params: z.object({
        teamId: z.uuid(),
        token: z.uuid(),
      }),
    },
  },
  getTeam: {
    controllerFn: () => getTeam,
    responseType: z.any(),
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
    },
  },
  updateTeam: {
    controllerFn: () => updateTeam,
    responseType: z.any(),
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
      params: z.object({
        teamId: z.uuid(),
      }),
      body: z.object({
        name: z.string().trim().min(2).max(255),
      }),
    },
  },
  getUserSessions: {
    controllerFn: () => getUserSessions,
    responseType: z.object({
      sessions: z.array(
        z.object({
          sid: z.string(),
          userId: z.uuid(),
          ipAddress: z.string().nullable(),
          userAgent: z.string().nullable(),
          createdAt: z.string(),
          lastActivityAt: z.string(),
        }),
      ),
      currentSessionId: z.string(),
    }),
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
      params: z.object({
        teamId: z.uuid(),
      }),
      query: z.object({
        limit: z.coerce.number().min(1).max(100).optional(),
        cursorId: z.coerce.string().optional(),
      }),
    },
  },
  revokeUserSession: {
    controllerFn: () => revokeUserSession,
    responseType: z.object({ success: z.boolean() }),
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
      params: z.object({
        teamId: z.uuid(),
        sessionId: z.string(),
      }),
    },
  },
  getUserAuthActivity: {
    controllerFn: () => getUserAuthActivity,
    responseType: z.object({
      records: z.array(
        z.object({
          id: z.number(),
          userId: z.uuid(),
          ipAddress: z.string().nullable(),
          userAgent: z.string().nullable(),
          activity: z.string(),
          createdAt: z.string(),
        }),
      ),
      hasMore: z.boolean(),
      lastKey: z.number().nullable(),
    }),
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
      params: z.object({
        teamId: z.uuid(),
      }),
      query: z.object({
        limit: z.coerce.number().min(1).max(100).optional(),
        cursorId: z.coerce.number().optional(),
      }),
    },
  },
  updateLoginConfiguration: {
    controllerFn: () => updateLoginConfiguration,
    responseType: z.any(),
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
      params: z.object({
        teamId: z.uuid(),
      }),
      body: TeamLoginConfigRequestSchema,
    },
  },
  updateTeamMember: {
    controllerFn: () => updateTeamMember,
    responseType: z.any(),
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
      params: z.object({
        teamId: z.uuid(),
        userId: z.uuid(),
      }),
      body: TeamMemberUpdateRequestSchema,
    },
  },
  updateTeamMemberStatusAndRole: {
    controllerFn: () => updateTeamMemberStatusAndRole,
    responseType: z.any(),
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
      params: z.object({
        teamId: z.uuid(),
        userId: z.uuid(),
      }),
      body: TeamMemberStatusUpdateRequestSchema,
    },
  },
  getInvitations: {
    controllerFn: () => getInvitations,
    responseType: z.array(z.any()),
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
      params: z.object({
        teamId: z.uuid(),
      }),
    },
  },
  createInvitation: {
    controllerFn: () => createInvitation,
    responseType: z.array(z.any()),
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
      params: z.object({
        teamId: z.uuid(),
      }),
      body: TeamInvitationRequestSchema,
    },
  },
  resendInvitation: {
    controllerFn: () => resendInvitation,
    responseType: z.array(z.any()),
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
      params: z.object({
        teamId: z.uuid(),
        id: z.uuid(),
      }),
      body: TeamInvitationUpdateRequestSchema,
    },
  },
  cancelInvitation: {
    controllerFn: () => cancelInvitation,
    responseType: z.array(z.any()),
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
      params: z.object({
        teamId: z.uuid(),
        id: z.uuid(),
      }),
    },
  },
};

const verifyInvitation = createRoute(routeDefinition.verifyInvitation.validators, async ({ user, params }, req, res) => {
  const { teamId, token } = params;

  teamService
    .verifyTeamInvitation({ teamId, token, currentSessionProvider: req.session.provider || 'credentials', user })
    .then((inviteVerification) => {
      sendJson(res, { success: true, inviteVerification });
    })
    .catch((error) => {
      logger.warn({ error: getErrorMessage(error), teamId, token, userId: user.id }, 'Error verifying team invitation');
      sendJson(res, { success: false });
    });
});

const acceptInvitation = createRoute(routeDefinition.acceptInvitation.validators, async ({ user, params, clearCookie }, req, res) => {
  const { teamId, token } = params;

  await teamService.acceptTeamInvitation({
    user,
    currentSessionProvider: req.session.provider || 'credentials',
    teamId,
    token,
  });

  const cookieConfig = authService.getCookieConfig(ENV.USE_SECURE_COOKIES);
  clearCookie(cookieConfig.redirectUrl.name, cookieConfig.redirectUrl.options);

  // ensure session is updated to include the teamMembership
  await authService.refreshSessionUser(req);

  sendJson(res, { success: true, redirectUrl: ENV.JETSTREAM_CLIENT_URL });
});

const getTeam = createRoute(routeDefinition.getTeam.validators, async ({ user }, req, res) => {
  const team = await teamService.getTeamByUserId({ userId: user.id });
  sendJson(res, team);
});

const updateTeam = createRoute(routeDefinition.updateTeam.validators, async ({ params, body, user }, req, res) => {
  const { teamId } = params;
  const team = await teamService.updateTeam({ runningUserId: user.id, teamId, payload: body });
  sendJson(res, team);
});

const getUserSessions = createRoute(routeDefinition.getUserSessions.validators, async ({ params, query }, req, res) => {
  const { teamId } = params;
  const { limit, cursorId: sid } = query || {};
  const cursor = sid ? { sid } : undefined;
  const sessions = await authService.getTeamUserSessions({ teamId, limit, cursor });
  sendJson(res, { sessions, currentSessionId: req.session.id });
});

const revokeUserSession = createRoute(routeDefinition.revokeUserSession.validators, async ({ params, body }, req, res) => {
  const { teamId, sessionId } = params;
  await authService.revokeTeamUserSession({ teamId, sessionId });
  sendJson(res, { success: true });
});

const getUserAuthActivity = createRoute(routeDefinition.getUserAuthActivity.validators, async ({ params, query }, req, res) => {
  const { teamId } = params;
  const { limit, cursorId: id } = query || {};
  const cursor = id ? { id } : undefined;
  const authActivity = await authService.getTeamUserActivity({ teamId, limit, cursor });
  sendJson(res, authActivity);
});

const updateLoginConfiguration = createRoute(
  routeDefinition.updateLoginConfiguration.validators,
  async ({ params, body, user }, req, res) => {
    const { teamId } = params;
    const team = await teamService.updateLoginConfiguration({ runningUserId: user.id, teamId, loginConfiguration: body });
    sendJson(res, team);
  },
);

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

const updateTeamMemberStatusAndRole = createRoute(
  routeDefinition.updateTeamMemberStatusAndRole.validators,
  async ({ params, body, user }, req, res) => {
    const { teamId, userId } = params;
    const { status, role } = body;
    const team = await teamService.updateTeamMemberStatusAndRole({ teamId, userId, status, role, runningUserId: user.id });
    sendJson(res, team);
  },
);

const getInvitations = createRoute(routeDefinition.getInvitations.validators, async ({ params }, req, res) => {
  const { teamId } = params;
  const invitations = await teamService.getTeamInvitations({ teamId });
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

const resendInvitation = createRoute(routeDefinition.resendInvitation.validators, async ({ params, body, user }, req, res) => {
  const { teamId, id } = params;
  const invitations = await teamService.resendInvitation({
    runningUserId: user.id,
    teamId,
    invitationId: id,
    request: body,
  });
  sendJson(res, invitations);
});

const cancelInvitation = createRoute(routeDefinition.cancelInvitation.validators, async ({ params }, req, res) => {
  const { teamId, id } = params;
  const invitations = await teamService.revokeTeamInvitation({ id, teamId });
  sendJson(res, invitations);
});
