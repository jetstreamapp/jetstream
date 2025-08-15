import { TEAM_ROLE_ADMIN, TEAM_ROLE_MEMBER, TeamMemberRole, TeamMemberRoleSchema } from '@jetstream/types';
import express from 'express';
import Router from 'express-promise-router';
import { routeDefinition as billingController } from '../controllers/billing.controller';
import { routeDefinition as teamController } from '../controllers/team.controller';
import { checkTeamRole } from '../db/team.db';
import { checkAuth } from './route.middleware';

const routes: express.Router = Router();

function validateTeamRoleMiddlewareFn(roles: TeamMemberRole[]) {
  return async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (!req.session.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (!req.session.teamMembership) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    if (!req.params.teamId) {
      return res.status(400).json({ error: 'Team ID is required' });
    }
    if (req.session.teamMembership.teamId !== req.params.teamId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    if (!TeamMemberRoleSchema.array().safeParse(roles).success) {
      return res.status(400).json({ error: 'Invalid request' });
    }
    const isAdmin = await checkTeamRole({ teamId: req.params.teamId, userId: req.session.user.id, roles });
    if (!isAdmin) {
      return res.status(403).json({ error: 'Unauthorized' });
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

routes.get('/:teamId', validateTeamRoleMiddlewareFn([TEAM_ROLE_ADMIN]), teamController.getTeam.controllerFn());

routes.get('/:teamId/sessions', validateTeamRoleMiddlewareFn([TEAM_ROLE_ADMIN]), teamController.getUserSessions.controllerFn());
routes.get('/:teamId/auth-activity', validateTeamRoleMiddlewareFn([TEAM_ROLE_ADMIN]), teamController.getUserAuthActivity.controllerFn());
routes.post(
  '/:teamId/login-configuration',
  validateTeamRoleMiddlewareFn([TEAM_ROLE_ADMIN]),
  teamController.updateLoginConfiguration.controllerFn()
);

// routes.put('/:teamId/members/:userId', validateTeamRoleMiddleware([TEAM_ROLE_ADMIN]), teamController.updateLoginConfiguration.controllerFn());
routes.put(
  '/:teamId/members/:userId/status',
  validateTeamRoleMiddlewareFn([TEAM_ROLE_ADMIN]),
  teamController.updateTeamMemberStatus.controllerFn()
);

routes.get('/:teamId/invitations', validateTeamRoleMiddlewareFn([TEAM_ROLE_ADMIN]), teamController.getInvitations.controllerFn());
routes.post('/:teamId/invitations', validateTeamRoleMiddlewareFn([TEAM_ROLE_ADMIN]), teamController.createInvitation.controllerFn());
routes.put('/:teamId/invitations/:id', validateTeamRoleMiddlewareFn([TEAM_ROLE_ADMIN]), teamController.resendInvitation.controllerFn());
routes.delete('/:teamId/invitations/:id', validateTeamRoleMiddlewareFn([TEAM_ROLE_ADMIN]), teamController.cancelInvitation.controllerFn());
routes.post(
  '/:teamId/billing/portal',
  validateTeamRoleMiddlewareFn([TEAM_ROLE_MEMBER, TEAM_ROLE_ADMIN]),
  billingController.createTeamBillingPortalSession.controllerFn()
);

export default routes;
