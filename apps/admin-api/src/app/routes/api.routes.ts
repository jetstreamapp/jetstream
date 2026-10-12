import {
  ApproveTeamDomainRequestSchema,
  IdParamsSchema,
  PaginatedSearchQuerySchema,
  ProvisioningLookupParamsSchema,
  ProvisioningLookupQuerySchema,
  ProvisionTeamRequestSchema,
  SendTeamInvitationRequestSchema,
  StripeCustomerSearchQuerySchema,
  TeamInvitationParamsSchema,
  TeamMemberToAddSchema,
  UserListQuerySchema,
} from '@jetstream/admin/types';
import { createRateLimit } from '@jetstream/api-config';
import express from 'express';
import { requireAdminRequestHeader, requireAdminSession } from '../auth/auth.middleware';
import { getDashboardSummary } from '../metrics/dashboard.db';
import { searchStripeCustomers } from '../stripe/stripe-customers.service';
import { approveTeamDomain } from '../teams/team-domains.service';
import { resendTeamInvitation, revokeTeamInvitation, sendTeamInvitation } from '../teams/team-invitations.service';
import { addTeamMember } from '../teams/team-members.service';
import { getProvisioningLookup, linkTeamToStripe, provisionTeam } from '../teams/team-provisioning.service';
import { getTeamDetail, searchTeams } from '../teams/teams.db';
import { getUserDetail, searchUsers } from '../users/users.db';
import { createRoute } from '../utils/route.utils';

export const apiRoutes: express.Router = express.Router();

apiRoutes.use(createRateLimit('admin-api', { limit: 600 }));
apiRoutes.use(requireAdminSession);
apiRoutes.use(requireAdminRequestHeader);

apiRoutes.get(
  '/me',
  createRoute({}, async ({ admin }) => admin),
);

apiRoutes.get(
  '/dashboard',
  createRoute({}, async () => getDashboardSummary()),
);

apiRoutes.get(
  '/teams',
  createRoute({ query: PaginatedSearchQuerySchema }, async ({ query }) => searchTeams(query)),
);

apiRoutes.post(
  '/teams',
  createRoute({ body: ProvisionTeamRequestSchema, status: 201 }, async ({ body, admin, requestMetadata }) =>
    provisionTeam(body, admin, requestMetadata),
  ),
);

apiRoutes.get(
  '/teams/:id',
  createRoute({ params: IdParamsSchema }, async ({ params }) => getTeamDetail(params.id)),
);

apiRoutes.post(
  '/teams/:id/stripe-link',
  createRoute({ params: IdParamsSchema }, async ({ params, admin, requestMetadata }) =>
    linkTeamToStripe(params.id, admin, requestMetadata),
  ),
);

apiRoutes.post(
  '/teams/:id/members',
  createRoute({ params: IdParamsSchema, body: TeamMemberToAddSchema, status: 201 }, async ({ params, body, admin, requestMetadata }) =>
    addTeamMember(params.id, body, admin, requestMetadata),
  ),
);

apiRoutes.post(
  '/teams/:id/domains',
  createRoute(
    { params: IdParamsSchema, body: ApproveTeamDomainRequestSchema, status: 201 },
    async ({ params, body, admin, requestMetadata }) => approveTeamDomain(params.id, body.domain, admin, requestMetadata),
  ),
);

apiRoutes.post(
  '/teams/:id/invitations',
  createRoute(
    { params: IdParamsSchema, body: SendTeamInvitationRequestSchema, status: 201 },
    async ({ params, body, admin, requestMetadata }) => sendTeamInvitation(params.id, body, admin, requestMetadata),
  ),
);

apiRoutes.post(
  '/teams/:id/invitations/:invitationId/resend',
  createRoute({ params: TeamInvitationParamsSchema }, async ({ params, admin, requestMetadata }) =>
    resendTeamInvitation(params.id, params.invitationId, admin, requestMetadata),
  ),
);

apiRoutes.delete(
  '/teams/:id/invitations/:invitationId',
  createRoute({ params: TeamInvitationParamsSchema }, async ({ params, admin, requestMetadata }) =>
    revokeTeamInvitation(params.id, params.invitationId, admin, requestMetadata),
  ),
);

apiRoutes.get(
  '/stripe/customers',
  createRoute({ query: StripeCustomerSearchQuerySchema }, async ({ query }) => searchStripeCustomers(query.query)),
);

apiRoutes.get(
  '/provisioning/:customerId',
  createRoute({ params: ProvisioningLookupParamsSchema, query: ProvisioningLookupQuerySchema }, async ({ params, query }) =>
    getProvisioningLookup(params.customerId, query.quoteId),
  ),
);

apiRoutes.get(
  '/users',
  createRoute({ query: UserListQuerySchema }, async ({ query }) => searchUsers(query)),
);

apiRoutes.get(
  '/users/:id',
  createRoute({ params: IdParamsSchema }, async ({ params }) => getUserDetail(params.id)),
);
