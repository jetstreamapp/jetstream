import express from 'express';
import Router from 'express-promise-router';
import { routeDefinition as teamController } from '../controllers/team.controller';
import { isTeamAdministrator } from '../db/team.db';
import { checkAuth } from './route.middleware';

const routes: express.Router = Router();

async function isTeamAdministratorMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!req.session.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!Array.isArray(req.session.teamMemberships)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  if (!req.params.teamId) {
    return res.status(400).json({ error: 'Team ID is required' });
  }
  if (!req.session.teamMemberships.includes(req.params.teamId)) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  const isAdmin = await isTeamAdministrator({ teamId: req.params.id, userId: req.session.user.id });
  if (!isAdmin) {
    return res.status(403).json({ error: 'Unauthorized' });
  }
  next();
}

/**
 * Unauthenticated Routes
 */
routes.get('/:teamId/invitations/:token/verify', teamController.verifyInvitation.controllerFn());

/**
 * Authenticated Routes
 */
routes.use(checkAuth);

routes.post('/:teamId/invitations/:token/accept', checkAuth, teamController.acceptInvitation.controllerFn());

// This is an admin route, but is handled at the database level since we don't have the teamId
routes.get('/', teamController.getTeam.controllerFn());

routes.get('/:teamId/sessions', isTeamAdministratorMiddleware, teamController.getUserSessions.controllerFn());
routes.get('/:teamId/auth-activity', isTeamAdministratorMiddleware, teamController.getUserAuthActivity.controllerFn());
routes.post('/:teamId/login-configuration', isTeamAdministratorMiddleware, teamController.updateLoginConfiguration.controllerFn());

routes.put('/:teamId/members/:userId', isTeamAdministratorMiddleware, teamController.updateLoginConfiguration.controllerFn());
routes.put('/:teamId/members/:userId/:status', isTeamAdministratorMiddleware, teamController.updateLoginConfiguration.controllerFn());

routes.get('/:teamId/invitations', isTeamAdministratorMiddleware, teamController.getInvitations.controllerFn());
routes.post('/:teamId/invitations', isTeamAdministratorMiddleware, teamController.createInvitation.controllerFn());
routes.put('/:teamId/invitations/:id', isTeamAdministratorMiddleware, teamController.updateInvitation.controllerFn());
routes.delete('/:teamId/invitations/:id', isTeamAdministratorMiddleware, teamController.cancelInvitation.controllerFn());

export default routes;
