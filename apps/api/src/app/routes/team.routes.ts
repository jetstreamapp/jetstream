import { Request, Response } from '@jetstream/api-types';
import * as authService from '@jetstream/auth/server';
import { TEAM_MEMBER_ROLE_ADMIN, TEAM_MEMBER_ROLE_BILLING, TeamMemberRole, TeamMemberRoleSchema } from '@jetstream/types';
import express, { Router } from 'express';
import { routeDefinition as teamController } from '../controllers/team.controller';
import { checkTeamRole } from '../db/team.db';
import { checkAuth } from './route.middleware';

/**
 * Route Prefix: /api/teams
 */

const routes: express.Router = Router();

function validateTeamRoleMiddlewareFn(roles: TeamMemberRole[]) {
  return async (req: Request, res: Response, next: express.NextFunction) => {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!req.params.teamId) {
      return res.status(400).json({ error: 'Team ID is required' });
    }
    if (!TeamMemberRoleSchema.array().safeParse(roles).success) {
      return res.status(400).json({ error: 'Invalid request' });
    }
    const hasValidRole = await checkTeamRole({ teamId: req.params.teamId, userId: req.session.user.id, roles });
    if (!hasValidRole) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    if (!req.session.user.teamMembership) {
      // Team does not exist on session, refresh session (e.g. team membership was assigned after user logged in)
      await authService.refreshSessionUser(req);
    }

    next();
  };
}

routes.use(checkAuth);

routes.get('/:teamId/invitations/:token/verify', teamController.verifyInvitation.controllerFn());
routes.post('/:teamId/invitations/:token/accept', teamController.acceptInvitation.controllerFn());

/**
 * ADMIN ONLY ROUTES
 */

routes.get(
  '/:teamId',
  validateTeamRoleMiddlewareFn([TEAM_MEMBER_ROLE_ADMIN, TEAM_MEMBER_ROLE_BILLING]),
  teamController.getTeam.controllerFn(),
);

routes.put(
  '/:teamId',
  validateTeamRoleMiddlewareFn([TEAM_MEMBER_ROLE_ADMIN, TEAM_MEMBER_ROLE_BILLING]),
  teamController.updateTeam.controllerFn(),
);

routes.get(
  '/:teamId/sessions',
  validateTeamRoleMiddlewareFn([TEAM_MEMBER_ROLE_ADMIN, TEAM_MEMBER_ROLE_BILLING]),
  teamController.getUserSessions.controllerFn(),
);
routes.delete(
  '/:teamId/sessions/:sessionId',
  validateTeamRoleMiddlewareFn([TEAM_MEMBER_ROLE_ADMIN]),
  teamController.revokeUserSession.controllerFn(),
);
routes.get(
  '/:teamId/auth-activity',
  validateTeamRoleMiddlewareFn([TEAM_MEMBER_ROLE_ADMIN, TEAM_MEMBER_ROLE_BILLING]),
  teamController.getUserAuthActivity.controllerFn(),
);
routes.post(
  '/:teamId/login-configuration',
  validateTeamRoleMiddlewareFn([TEAM_MEMBER_ROLE_ADMIN]),
  teamController.updateLoginConfiguration.controllerFn(),
);
routes.put(
  '/:teamId/members/:userId',
  validateTeamRoleMiddlewareFn([TEAM_MEMBER_ROLE_ADMIN, TEAM_MEMBER_ROLE_BILLING]),
  teamController.updateTeamMember.controllerFn(),
);
routes.put(
  '/:teamId/members/:userId/status',
  validateTeamRoleMiddlewareFn([TEAM_MEMBER_ROLE_ADMIN, TEAM_MEMBER_ROLE_BILLING]),
  teamController.updateTeamMemberStatusAndRole.controllerFn(),
);

routes.get(
  '/:teamId/invitations',
  validateTeamRoleMiddlewareFn([TEAM_MEMBER_ROLE_ADMIN, TEAM_MEMBER_ROLE_BILLING]),
  teamController.getInvitations.controllerFn(),
);
routes.post(
  '/:teamId/invitations',
  validateTeamRoleMiddlewareFn([TEAM_MEMBER_ROLE_ADMIN, TEAM_MEMBER_ROLE_BILLING]),
  teamController.createInvitation.controllerFn(),
);
routes.put(
  '/:teamId/invitations/:id',
  validateTeamRoleMiddlewareFn([TEAM_MEMBER_ROLE_ADMIN, TEAM_MEMBER_ROLE_BILLING]),
  teamController.resendInvitation.controllerFn(),
);
routes.delete(
  '/:teamId/invitations/:id',
  validateTeamRoleMiddlewareFn([TEAM_MEMBER_ROLE_ADMIN, TEAM_MEMBER_ROLE_BILLING]),
  teamController.cancelInvitation.controllerFn(),
);

export default routes;
