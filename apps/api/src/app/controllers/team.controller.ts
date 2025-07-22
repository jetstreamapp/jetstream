import { ENV, logger } from '@jetstream/api-config';
import * as authDbService from '@jetstream/auth/server';
import { sendTeamInviteEmail } from '@jetstream/email';
import { getErrorMessage } from '@jetstream/shared/utils';
import { TeamInvitationRequestSchema, TeamInvitationUpdateRequestSchema, TeamLoginConfigRequestSchema } from '@jetstream/types';
import { z } from 'zod';
import * as teamDbService from '../db/team.db';
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
      query: z.object({
        returnUrl: z.string().startsWith('/'),
      }),
    },
  },
  getTeam: {
    controllerFn: () => getTeam,
    validators: {
      hasSourceOrg: false,
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
  updateInvitation: {
    controllerFn: () => updateInvitation,
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
  acceptInvitation: {
    controllerFn: () => acceptInvitation,
    validators: {
      hasSourceOrg: false,
      params: z.object({
        teamId: z.string().uuid(),
        token: z.string().uuid(),
      }),
      body: z.object({
        csrfToken: z.string(),
      }),
    },
  },
};

/**
 * !UNAUTHENTICATED ROUTE!
 * Determine if an invitation is valid
 */
const verifyInvitation = createRoute(routeDefinition.verifyInvitation.validators, async ({ user, params, query, setCookie }, req, res) => {
  const { teamId, token } = params;
  const { returnUrl } = query;
  const cookieConfig = authDbService.getCookieConfig(ENV.USE_SECURE_COOKIES);

  // Check if user is authenticated - redirect to login or register
  if (!req.session.user) {
    setCookie(cookieConfig.redirectUrl.name, returnUrl, cookieConfig.redirectUrl.options);
    sendJson(res, { success: false, authenticated: false, action: 'redirect-to-login' });
    return;
  }

  teamDbService
    .verifyTeamInvitation({ teamId, token, user })
    .then(() => {
      sendJson(res, { success: true, authenticated: true, action: 'continue' });
    })
    .catch((error) => {
      logger.warn({ error: getErrorMessage(error), teamId, token, userId: user.id }, 'Error verifying team invitation');
      sendJson(res, { success: false, authenticated: true, action: 'error' });
    });
});

const getTeam = createRoute(routeDefinition.getTeam.validators, async ({ user }, req, res) => {
  const team = await teamDbService.findByUserId({ userId: user.id });
  sendJson(res, team);
});

const getUserSessions = createRoute(routeDefinition.getUserSessions.validators, async ({ user, params }, req, res) => {
  const { teamId } = params;
  const sessions = await authDbService.getTeamUserSessions(teamId);
  sendJson(res, sessions);
});

const getUserAuthActivity = createRoute(routeDefinition.getUserAuthActivity.validators, async ({ user, params }, req, res) => {
  const { teamId } = params;
  const authActivity = await authDbService.getTeamUserActivity(teamId);
  sendJson(res, authActivity);
});

const updateLoginConfiguration = createRoute(routeDefinition.updateLoginConfiguration.validators, async ({ params, body }, req, res) => {
  const { teamId } = params;
  const team = await teamDbService.updateLoginConfiguration({ teamId, loginConfiguration: body });
  sendJson(res, team);
});

const getInvitations = createRoute(routeDefinition.getInvitations.validators, async ({ params, body }, req, res) => {
  const { teamId } = params;
  const invitations = await teamDbService.getTeamInvitations({ teamId });
  sendJson(res, invitations);
});

const createInvitation = createRoute(routeDefinition.createInvitation.validators, async ({ user, params, body }, req, res) => {
  const { teamId } = params;
  const { email, token, team } = await teamDbService.createTeamInvitation({
    createdByUserId: user.id,
    teamId,
    request: body,
  });
  await sendTeamInviteEmail({
    emailAddress: email,
    teamId,
    teamName: team.name,
    token,
    expiresInDays: teamDbService.TEAM_INVITE_EXPIRES_DAYS,
  });
  const invitations = await teamDbService.getTeamInvitations({ teamId });
  sendJson(res, invitations);
});

const updateInvitation = createRoute(routeDefinition.updateInvitation.validators, async ({ params, body }, req, res) => {
  const { teamId, id } = params;
  const { email, token, team } = await teamDbService.updateTeamInvitation({
    id,
    teamId,
    request: body,
  });
  await sendTeamInviteEmail({
    emailAddress: email,
    teamId,
    teamName: team.name,
    token,
    expiresInDays: teamDbService.TEAM_INVITE_EXPIRES_DAYS,
  });
  const invitations = await teamDbService.getTeamInvitations({ teamId });
  sendJson(res, invitations);
});

const cancelInvitation = createRoute(routeDefinition.cancelInvitation.validators, async ({ params }, req, res) => {
  const { teamId, id } = params;
  await teamDbService.revokeTeamInvitation({ id, teamId });
  const invitations = await teamDbService.getTeamInvitations({ teamId });
  sendJson(res, invitations);
});

const acceptInvitation = createRoute(routeDefinition.acceptInvitation.validators, async ({ user, body, params, clearCookie }, req, res) => {
  const { teamId, token } = params;
  const { csrfToken } = body;

  await authDbService.verifyCSRFFromRequestOrThrow(csrfToken, req.headers.cookie || '');

  const cookieConfig = authDbService.getCookieConfig(ENV.USE_SECURE_COOKIES);
  await teamDbService.acceptTeamInvitation({ teamId, token, user });
  clearCookie(cookieConfig.redirectUrl.name, cookieConfig.redirectUrl.options);

  sendJson(res, { success: true, redirectUrl: ENV.JETSTREAM_CLIENT_URL });
});
