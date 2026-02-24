import { ENV, logger } from '@jetstream/api-config';
import { AuditLogAction, AuditLogResource, createTeamAuditLog } from '@jetstream/audit-logs';
import * as authService from '@jetstream/auth/server';
import { encryptSecret, oidcService, samlService } from '@jetstream/auth/server';
import { OidcConfigurationRequestSchema, SamlConfigurationRequestSchema } from '@jetstream/auth/types';
import { BLOCKED_PUBLIC_EMAIL_DOMAINS } from '@jetstream/shared/constants';
import { getErrorMessage, getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import {
  TEAM_MEMBER_ROLE_ACCESS,
  TEAM_MEMBER_ROLE_MEMBER,
  TeamInvitationRequestSchema,
  TeamInvitationUpdateRequestSchema,
  TeamLoginConfigRequestSchema,
  TeamMemberRole,
  TeamMemberRoleSchema,
  TeamMemberStatusUpdateRequestSchema,
  TeamMemberUpdateRequestSchema,
} from '@jetstream/types';
import * as crypto from 'crypto';
import * as dns from 'dns/promises';
import { unparse } from 'papaparse';
import { z } from 'zod';
import * as teamDb from '../db/team.db';
import * as teamService from '../services/team.service';
import { NotAllowedError, NotFoundError } from '../utils/error-handler';
import { assertDomainResolvesToPublicIp } from '../utils/network.utils';
import { sendJson } from '../utils/response.handlers';
import { createRoute } from '../utils/route.utils';

export const routeDefinition = {
  verifyInvitation: {
    controllerFn: () => verifyInvitation,
    responseType: z.object({ success: z.boolean(), inviteVerification: z.object({ email: z.email() }).nullish() }),
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
    responseType: z.object({ success: z.boolean(), redirectUrl: z.url().nullish() }),
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
  // SSO Configuration
  getSsoConfig: {
    controllerFn: () => getSsoConfig,
    responseType: z.any(),
    validators: {
      hasSourceOrg: false,
      params: z.object({ teamId: z.uuid() }),
    },
  },
  parseSamlMetadata: {
    controllerFn: () => parseSamlMetadata,
    responseType: z.any(),
    validators: {
      hasSourceOrg: false,
      params: z.object({ teamId: z.uuid() }),
      body: z
        .object({ metadataXml: z.string().optional(), metadataUrl: z.url().optional() })
        .refine((data) => data.metadataXml || data.metadataUrl, {
          message: 'Either metadataXml or metadataUrl is required',
        }),
    },
  },
  createOrUpdateSamlConfig: {
    controllerFn: () => createOrUpdateSamlConfig,
    responseType: z.any(),
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
      params: z.object({ teamId: z.uuid() }),
      body: SamlConfigurationRequestSchema,
    },
  },
  discoverOidcConfig: {
    controllerFn: () => discoverOidcConfig,
    responseType: z.any(),
    validators: {
      hasSourceOrg: false,
      params: z.object({ teamId: z.uuid() }),
      body: z.object({ issuer: z.url() }),
    },
  },
  createOrUpdateOidcConfig: {
    controllerFn: () => createOrUpdateOidcConfig,
    responseType: z.any(),
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
      params: z.object({ teamId: z.uuid() }),
      body: OidcConfigurationRequestSchema,
    },
  },
  updateSsoSettings: {
    controllerFn: () => updateSsoSettings,
    responseType: z.any(),
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
      params: z.object({ teamId: z.uuid() }),
      body: z.object({
        ssoEnabled: z.boolean(),
        ssoJitProvisioningEnabled: z.boolean(),
        ssoBypassEnabled: z.boolean(),
        ssoBypassEnabledRoles: TeamMemberRoleSchema.array(),
      }),
    },
  },
  deleteSamlConfig: {
    controllerFn: () => deleteSamlConfig,
    responseType: z.any(),
    validators: {
      hasSourceOrg: false,
      params: z.object({ teamId: z.uuid() }),
    },
  },
  deleteOidcConfig: {
    controllerFn: () => deleteOidcConfig,
    responseType: z.any(),
    validators: {
      hasSourceOrg: false,
      params: z.object({ teamId: z.uuid() }),
    },
  },
  getDomainVerifications: {
    controllerFn: () => getDomainVerifications,
    responseType: z.any(),
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
      params: z.object({
        teamId: z.uuid(),
      }),
    },
  },
  saveDomainVerification: {
    controllerFn: () => saveDomainVerification,
    responseType: z.any(),
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
      params: z.object({
        teamId: z.uuid(),
      }),
      body: z.object({
        domain: z.string().toLowerCase().regex(z.regexes.domain).min(1).max(255),
      }),
    },
  },
  verifyDomain: {
    controllerFn: () => verifyDomain,
    responseType: z.any(),
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
      params: z.object({
        teamId: z.uuid(),
        domainId: z.uuid(),
      }),
    },
  },
  deleteDomainVerification: {
    controllerFn: () => deleteDomainVerification,
    responseType: z.any(),
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
      params: z.object({
        teamId: z.uuid(),
        domainId: z.uuid(),
      }),
    },
  },
  getTeamAuditLogs: {
    controllerFn: () => getTeamAuditLogs,
    responseType: z.any(),
    validators: {
      hasSourceOrg: false,
      logErrorToBugTracker: true,
      params: z.object({ teamId: z.uuid() }),
      query: z.object({
        limit: z.coerce.number().min(1).max(100).optional(),
        cursorId: z.uuid().optional(),
        startDate: z.coerce.date().optional(),
        endDate: z.coerce.date().optional(),
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

  const {
    email: inviteeEmail,
    role,
    features,
  } = await teamService.acceptTeamInvitation({
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

  createTeamAuditLog({
    userId: user.id,
    teamId,
    action: AuditLogAction.TEAM_INVITATION_ACCEPTED,
    resource: AuditLogResource.TEAM_MEMBER,
    resourceId: user.id,
    metadata: { inviteeEmail, role, features },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] as string,
  });
});

const getTeam = createRoute(routeDefinition.getTeam.validators, async ({ user }, _, res) => {
  const team = await teamService.getTeamByUserId({ userId: user.id });
  sendJson(res, team);
});

const updateTeam = createRoute(routeDefinition.updateTeam.validators, async ({ params, body, user }, req, res) => {
  const { teamId } = params;
  // Pre-fetch current name for the audit diff before overwriting it
  const previousTeam = await teamDb.findById({ teamId });
  const team = await teamService.updateTeam({ runningUserId: user.id, teamId, payload: body });
  sendJson(res, team);

  createTeamAuditLog({
    userId: user.id,
    teamId,
    action: AuditLogAction.TEAM_UPDATED,
    resource: AuditLogResource.TEAM,
    resourceId: teamId,
    metadata: { previousName: previousTeam.name, newName: team.name },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] as string,
  });
});

const getUserSessions = createRoute(routeDefinition.getUserSessions.validators, async ({ params, query }, req, res) => {
  const { teamId } = params;
  const { limit, cursorId: sid } = query || {};
  const cursor = sid ? { sid } : undefined;
  const sessions = await authService.getTeamUserSessions({ teamId, limit, cursor });
  sendJson(res, { sessions, currentSessionId: req.session.id });
});

const revokeUserSession = createRoute(routeDefinition.revokeUserSession.validators, async ({ params, user }, req, res) => {
  const { teamId, sessionId } = params;
  // Pre-fetch the session's owner before deletion for the audit log
  const targetUserId = await teamDb.getSessionUserId(sessionId);
  await authService.revokeTeamUserSession({ teamId, sessionId });
  sendJson(res, { success: true });

  if (targetUserId) {
    createTeamAuditLog({
      userId: user.id,
      teamId,
      action: AuditLogAction.TEAM_SESSION_REVOKED,
      resource: AuditLogResource.TEAM_MEMBER,
      resourceId: targetUserId,
      metadata: { targetUserId, sessionId },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string,
    });
  }
});

const getUserAuthActivity = createRoute(routeDefinition.getUserAuthActivity.validators, async ({ params, query }, _, res) => {
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
    const { team, previousLoginConfig, sessionsRevoked } = await teamService.updateLoginConfiguration({
      runningUserId: user.id,
      teamId,
      loginConfiguration: body,
    });
    sendJson(res, team);

    // Build a diff of only the fields that actually changed
    const changes: Record<string, { from: unknown; to: unknown }> = {};
    if (previousLoginConfig) {
      if (previousLoginConfig.requireMfa !== body.requireMfa) {
        changes.requireMfa = { from: previousLoginConfig.requireMfa, to: body.requireMfa };
      }
      if (previousLoginConfig.allowIdentityLinking !== body.allowIdentityLinking) {
        changes.allowIdentityLinking = { from: previousLoginConfig.allowIdentityLinking, to: body.allowIdentityLinking };
      }
      if ([...previousLoginConfig.allowedMfaMethods].sort().join(',') !== [...body.allowedMfaMethods].sort().join(',')) {
        changes.allowedMfaMethods = { from: previousLoginConfig.allowedMfaMethods, to: body.allowedMfaMethods };
      }
      if ([...previousLoginConfig.allowedProviders].sort().join(',') !== [...body.allowedProviders].sort().join(',')) {
        changes.allowedProviders = { from: previousLoginConfig.allowedProviders, to: body.allowedProviders };
      }
      if (previousLoginConfig.ssoRequireMfa !== body.ssoRequireMfa) {
        changes.ssoRequireMfa = { from: previousLoginConfig.ssoRequireMfa, to: body.ssoRequireMfa };
      }
    }

    createTeamAuditLog({
      userId: user.id,
      teamId,
      action: AuditLogAction.LOGIN_CONFIG_UPDATED,
      resource: AuditLogResource.TEAM_LOGIN_CONFIG,
      resourceId: team.loginConfigId ?? undefined,
      metadata: { changes, sessionsRevoked },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string,
    });
  },
);

const updateTeamMember = createRoute(routeDefinition.updateTeamMember.validators, async ({ params, body, user }, req, res) => {
  const { teamId, userId } = params;
  const runningUserRole = user.teamMembership?.role || TEAM_MEMBER_ROLE_MEMBER;

  // TODO: we may want to allow a user to change their own role in some cases (E.g. ADMIN->BILLING when there are multiple admins)
  if (body.role && user.id === userId && body.role !== runningUserRole) {
    throw new Error('You cannot change your own role');
  }

  await teamService.canRunningUserUpdateTargetUserOrThrow({ runningUserRole, userId });

  const allowedRoleUpdates = new Set((TEAM_MEMBER_ROLE_ACCESS[runningUserRole] || []) as TeamMemberRole[]);
  if (body.role && !allowedRoleUpdates.has(body.role)) {
    throw new NotAllowedError('You are not allowed to assign the specified role');
  }

  const { team, previousMember } = await teamService.updateTeamMember({ teamId, userId, data: body, runningUserId: user.id });
  sendJson(res, team);

  const updatedMember = team.members.find((member) => member.userId === userId);
  createTeamAuditLog({
    userId: user.id,
    teamId,
    action: AuditLogAction.TEAM_MEMBER_ROLE_UPDATED,
    resource: AuditLogResource.TEAM_MEMBER,
    resourceId: userId,
    metadata: {
      targetUserId: userId,
      targetEmail: previousMember.email,
      previousRole: previousMember.role,
      newRole: updatedMember?.role ?? body.role,
      previousFeatures: previousMember.features,
      newFeatures: updatedMember?.features ?? body.features,
    },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] as string,
  });
});

const updateTeamMemberStatusAndRole = createRoute(
  routeDefinition.updateTeamMemberStatusAndRole.validators,
  async ({ params, body, user }, req, res) => {
    const { teamId, userId } = params;
    const { status, role } = body;
    const runningUserRole = user.teamMembership?.role || TEAM_MEMBER_ROLE_MEMBER;

    const allowedRoleUpdates = new Set((TEAM_MEMBER_ROLE_ACCESS[runningUserRole] || []) as TeamMemberRole[]);
    if (role && !allowedRoleUpdates.has(role)) {
      throw new NotAllowedError('You are not allowed to assign the specified role');
    }

    await teamService.canRunningUserUpdateTargetUserOrThrow({ runningUserRole, userId });

    const { team, previousMember, allSessionsRevoked } = await teamService.updateTeamMemberStatusAndRole({
      teamId,
      userId,
      status,
      role,
      runningUserId: user.id,
    });
    sendJson(res, team);

    const updatedMember = team.members.find((member) => member.userId === userId);
    createTeamAuditLog({
      userId: user.id,
      teamId,
      action: AuditLogAction.TEAM_MEMBER_STATUS_UPDATED,
      resource: AuditLogResource.TEAM_MEMBER,
      resourceId: userId,
      metadata: {
        targetUserId: userId,
        targetEmail: previousMember.email,
        previousStatus: previousMember.status,
        newStatus: updatedMember?.status ?? status,
        previousRole: previousMember.role,
        newRole: updatedMember?.role ?? role ?? previousMember.role,
        allSessionsRevoked,
      },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string,
    });
  },
);

const getInvitations = createRoute(routeDefinition.getInvitations.validators, async ({ params }, _, res) => {
  const { teamId } = params;
  const invitations = await teamService.getTeamInvitations({ teamId });
  sendJson(res, invitations);
});

const createInvitation = createRoute(routeDefinition.createInvitation.validators, async ({ user, params, body }, req, res) => {
  const { teamId } = params;

  const allowedRoleUpdates = new Set(
    (TEAM_MEMBER_ROLE_ACCESS[user.teamMembership?.role || TEAM_MEMBER_ROLE_MEMBER] || []) as TeamMemberRole[],
  );

  if (!allowedRoleUpdates.has(body.role)) {
    throw new NotAllowedError('You are not allowed to assign the specified role');
  }

  const { invitations, createdInvitation } = await teamService.createInvitation({
    runningUserId: user.id,
    teamId,
    request: body,
  });
  sendJson(res, invitations);

  createTeamAuditLog({
    userId: user.id,
    teamId,
    action: AuditLogAction.TEAM_INVITATION_CREATED,
    resource: AuditLogResource.TEAM_INVITATION,
    resourceId: createdInvitation.id,
    metadata: {
      inviteeEmail: createdInvitation.email,
      role: createdInvitation.role,
      features: createdInvitation.features,
      expiresAt: createdInvitation.expiresAt.toISOString(),
    },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] as string,
  });
});

const resendInvitation = createRoute(routeDefinition.resendInvitation.validators, async ({ params, body, user }, req, res) => {
  const { teamId, id } = params;
  const { invitations, updatedInvitation } = await teamService.resendInvitation({
    runningUserId: user.id,
    teamId,
    invitationId: id,
    request: body,
  });
  sendJson(res, invitations);

  createTeamAuditLog({
    userId: user.id,
    teamId,
    action: AuditLogAction.TEAM_INVITATION_RESENT,
    resource: AuditLogResource.TEAM_INVITATION,
    resourceId: updatedInvitation.id,
    metadata: { inviteeEmail: updatedInvitation.email, role: updatedInvitation.role },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] as string,
  });
});

const cancelInvitation = createRoute(routeDefinition.cancelInvitation.validators, async ({ params, user }, req, res) => {
  const { teamId, id } = params;
  const { invitations, deletedInvitation } = await teamService.revokeTeamInvitation({ id, teamId });
  sendJson(res, invitations);

  createTeamAuditLog({
    userId: user.id,
    teamId,
    action: AuditLogAction.TEAM_INVITATION_CANCELLED,
    resource: AuditLogResource.TEAM_INVITATION,
    resourceId: id,
    metadata: { inviteeEmail: deletedInvitation.email, role: deletedInvitation.role },
    ipAddress: req.ip,
    userAgent: req.headers['user-agent'] as string,
  });
});

/**
 * SSO Configuration Controllers
 */

const getSsoConfig = createRoute(routeDefinition.getSsoConfig.validators, async ({ params }, _, res) => {
  const { teamId } = params;
  const config = await teamDb.getSsoConfiguration(teamId);
  sendJson(res, config);
});

const parseSamlMetadata = createRoute(routeDefinition.parseSamlMetadata.validators, async ({ body }, _, res, next) => {
  try {
    let xml: string;

    if (body.metadataUrl) {
      const metadataUrl = body.metadataUrl;

      // SSRF protection: resolve hostname and reject private/internal IPs
      await assertDomainResolvesToPublicIp(metadataUrl);

      const response = await fetch(metadataUrl, {
        signal: AbortSignal.timeout(10_000),
        headers: { Accept: 'application/xml, text/xml, */*' },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch metadata URL: HTTP ${response.status}`);
      }

      xml = await response.text();
    } else {
      // body.metadataXml is guaranteed by the refine validator
      xml = body.metadataXml!;
    }

    const parsed = await samlService.parseIdpMetadata(xml);
    sendJson(res, parsed);
  } catch (ex) {
    res.log.error(getErrorMessageAndStackObj(ex), 'Failed to parse SAML metadata');
    next(ex);
  }
});

const createOrUpdateSamlConfig = createRoute(
  routeDefinition.createOrUpdateSamlConfig.validators,
  async ({ params, body, user }, req, res, next) => {
    try {
      const { teamId } = params;
      let configData = body;

      const hasVerifiedDomain = await teamDb.hasVerifiedDomain(teamId);
      if (!hasVerifiedDomain) {
        throw new Error('At least one verified domain is required to configure SSO.');
      }

      // Parse metadata XML if provided
      if (body.idpMetadataXml) {
        const parsed = await samlService.parseIdpMetadata(body.idpMetadataXml);
        configData = {
          ...body,
          idpEntityId: parsed.entityId,
          idpSsoUrl: parsed.ssoUrl,
          idpCertificate: parsed.certificate,
        };
      }

      const {
        isNew,
        previous: previousSamlConfig,
        result: config,
      } = await teamDb.createOrUpdateSamlConfiguration(teamId, user.id, configData as any);

      sendJson(res, config);

      if (isNew) {
        createTeamAuditLog({
          userId: user.id,
          teamId,
          action: AuditLogAction.SSO_SAML_CONFIG_CREATED,
          resource: AuditLogResource.TEAM_SSO_CONFIG,
          resourceId: config.samlConfiguration?.id,
          metadata: {
            provider: 'SAML',
            idpEntityId: configData.idpEntityId,
            idpSsoUrl: configData.idpSsoUrl,
            certificateAdded: !!configData.idpCertificate,
            signRequests: configData.signRequests,
            attributeMapping: configData.attributeMapping,
            // nameIdFormat: configData.nameIdFormat,
            // wantAssertionsSigned: configData.wantAssertionsSigned,
          },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] as string,
        });
      } else if (previousSamlConfig) {
        const changes: Record<string, unknown> = {};
        // User cannot change these right now - no need to show in audit log diff until we allow changing them
        // In addition, these
        // if (previousSamlConfig.nameIdFormat !== configData.nameIdFormat) {
        //   changes.nameIdFormat = { from: previousSamlConfig.nameIdFormat, to: configData.nameIdFormat };
        // }
        // if (previousSamlConfig.signRequests !== configData.signRequests) {
        //   changes.signRequests = { from: previousSamlConfig.signRequests, to: configData.signRequests };
        // }
        // if (configData.spPrivateKey && configData.spPrivateKey !== previousSamlConfig.spPrivateKey) {
        //   changes.privateKeyUpdated = true;
        // }
        // if (previousSamlConfig.wantAssertionsSigned !== configData.wantAssertionsSigned) {
        //   changes.wantAssertionsSigned = { from: previousSamlConfig.wantAssertionsSigned, to: configData.wantAssertionsSigned };
        // }
        if (previousSamlConfig.idpEntityId !== configData.idpEntityId) {
          changes.idpEntityId = { from: previousSamlConfig.idpEntityId, to: configData.idpEntityId };
        }
        if (previousSamlConfig.idpSsoUrl !== configData.idpSsoUrl) {
          changes.idpSsoUrl = { from: previousSamlConfig.idpSsoUrl, to: configData.idpSsoUrl };
        }
        if (previousSamlConfig.idpCertificate !== configData.idpCertificate) {
          changes.certificateUpdated = true;
        }
        if (JSON.stringify(previousSamlConfig.attributeMapping) !== JSON.stringify(configData.attributeMapping)) {
          changes.attributeMapping = { from: previousSamlConfig.attributeMapping, to: configData.attributeMapping };
        }

        createTeamAuditLog({
          userId: user.id,
          teamId,
          action: AuditLogAction.SSO_SAML_CONFIG_UPDATED,
          resource: AuditLogResource.TEAM_SSO_CONFIG,
          resourceId: previousSamlConfig.id,
          metadata: { provider: 'SAML', configId: previousSamlConfig.id, changes },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] as string,
        });
      }
    } catch (ex) {
      res.log.error(getErrorMessageAndStackObj(ex), 'Failed to save SAML configuration');

      next(ex);
    }
  },
);

const discoverOidcConfig = createRoute(routeDefinition.discoverOidcConfig.validators, async ({ body }, _, res, next) => {
  try {
    const { issuer } = body;
    // SSRF protection: resolve hostname and reject private/internal IPs
    await assertDomainResolvesToPublicIp(issuer);
    const discovered = await oidcService.getDiscoveredConfigForSaving(issuer);
    sendJson(res, discovered);
  } catch (ex) {
    res.log.error(getErrorMessageAndStackObj(ex), 'Failed to discover OIDC configuration');
    next(ex);
  }
});

const createOrUpdateOidcConfig = createRoute(
  routeDefinition.createOrUpdateOidcConfig.validators,
  async ({ params, body, user }, req, res, next) => {
    try {
      const { teamId } = params;

      const hasVerifiedDomain = await teamDb.hasVerifiedDomain(teamId);
      if (!hasVerifiedDomain) {
        throw new Error('At least one verified domain is required to configure SSO.');
      }

      const existingConfig = await teamDb.getSsoConfiguration(teamId);
      let encryptedSecret = '';

      if (body.clientSecret) {
        // Encrypt new client secret
        encryptedSecret = encryptSecret(body.clientSecret);
      } else if (existingConfig.oidcConfiguration?.clientSecret) {
        // Use existing client secret
        encryptedSecret = existingConfig.oidcConfiguration.clientSecret;
      } else {
        throw new Error('Client Secret is required');
      }

      const {
        isNew,
        previous: previousOidcConfig,
        result: config,
      } = await teamDb.createOrUpdateOidcConfiguration(teamId, user.id, {
        ...body,
        clientSecret: encryptedSecret,
      });

      sendJson(res, config);

      if (isNew) {
        createTeamAuditLog({
          userId: user.id,
          teamId,
          action: AuditLogAction.SSO_OIDC_CONFIG_CREATED,
          resource: AuditLogResource.TEAM_SSO_CONFIG,
          resourceId: config.oidcConfiguration?.id,
          metadata: {
            provider: 'OIDC',
            issuer: body.issuer,
            clientId: body.clientId,
            scopes: body.scopes,
            attributeMapping: body.attributeMapping,
          },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] as string,
        });
      } else if (previousOidcConfig) {
        const changes: Record<string, unknown> = {};
        if (previousOidcConfig.issuer !== body.issuer) changes.issuer = { from: previousOidcConfig.issuer, to: body.issuer };
        if (previousOidcConfig.clientId !== body.clientId) changes.clientId = { from: previousOidcConfig.clientId, to: body.clientId };
        if (body.clientSecret) changes.clientSecretUpdated = true;
        if (previousOidcConfig.authorizationEndpoint !== body.authorizationEndpoint)
          changes.authorizationEndpoint = { from: previousOidcConfig.authorizationEndpoint, to: body.authorizationEndpoint };
        if (previousOidcConfig.tokenEndpoint !== body.tokenEndpoint)
          changes.tokenEndpoint = { from: previousOidcConfig.tokenEndpoint, to: body.tokenEndpoint };
        if ([...(previousOidcConfig.scopes ?? [])].sort().join(',') !== [...(body.scopes ?? [])].sort().join(','))
          changes.scopes = { from: previousOidcConfig.scopes, to: body.scopes };
        if (JSON.stringify(previousOidcConfig.attributeMapping) !== JSON.stringify(body.attributeMapping))
          changes.attributeMapping = { from: previousOidcConfig.attributeMapping, to: body.attributeMapping };

        createTeamAuditLog({
          userId: user.id,
          teamId,
          action: AuditLogAction.SSO_OIDC_CONFIG_UPDATED,
          resource: AuditLogResource.TEAM_SSO_CONFIG,
          resourceId: previousOidcConfig.id,
          metadata: { provider: 'OIDC', configId: previousOidcConfig.id, changes },
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'] as string,
        });
      }
    } catch (ex) {
      res.log.error(getErrorMessageAndStackObj(ex), 'Failed to save OIDC configuration');

      next(ex);
    }
  },
);

const updateSsoSettings = createRoute(routeDefinition.updateSsoSettings.validators, async ({ params, body, user }, req, res, next) => {
  try {
    const { teamId } = params;
    const { previousSettings, result: config } = await teamDb.updateSsoSettings(teamId, user.id, body);
    sendJson(res, config);

    const changes: Record<string, { from: unknown; to: unknown }> = {};
    if (previousSettings.ssoEnabled !== body.ssoEnabled) changes.ssoEnabled = { from: previousSettings.ssoEnabled, to: body.ssoEnabled };
    if (previousSettings.ssoJitProvisioningEnabled !== body.ssoJitProvisioningEnabled)
      changes.ssoJitProvisioningEnabled = { from: previousSettings.ssoJitProvisioningEnabled, to: body.ssoJitProvisioningEnabled };
    if (previousSettings.ssoBypassEnabled !== body.ssoBypassEnabled)
      changes.ssoBypassEnabled = { from: previousSettings.ssoBypassEnabled, to: body.ssoBypassEnabled };
    if ([...previousSettings.ssoBypassEnabledRoles].sort().join(',') !== [...body.ssoBypassEnabledRoles].sort().join(','))
      changes.ssoBypassEnabledRoles = { from: previousSettings.ssoBypassEnabledRoles, to: body.ssoBypassEnabledRoles };

    createTeamAuditLog({
      userId: user.id,
      teamId,
      action: AuditLogAction.SSO_SETTINGS_UPDATED,
      resource: AuditLogResource.TEAM_LOGIN_CONFIG,
      resourceId: config.id,
      metadata: { changes },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'] as string,
    });
  } catch (ex) {
    res.log.error(getErrorMessageAndStackObj(ex), 'Failed to update SSO settings');
    next(ex);
  }
});

const deleteSamlConfig = createRoute(routeDefinition.deleteSamlConfig.validators, async ({ params, user }, req, res, next) => {
  try {
    const { teamId } = params;
    const { deletedConfig, affectedIdentitiesCount } = await teamDb.deleteSamlConfiguration(teamId, user.id);
    sendJson(res, { success: true });

    if (deletedConfig) {
      createTeamAuditLog({
        userId: user.id,
        teamId,
        action: AuditLogAction.SSO_SAML_CONFIG_DELETED,
        resource: AuditLogResource.TEAM_SSO_CONFIG,
        resourceId: deletedConfig.id,
        metadata: { provider: 'SAML', idpEntityId: deletedConfig.idpEntityId, affectedIdentitiesCount },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string,
      });
    }
  } catch (ex) {
    res.log.error(getErrorMessageAndStackObj(ex), 'Failed to delete SAML configuration');
    next(ex);
  }
});

const deleteOidcConfig = createRoute(routeDefinition.deleteOidcConfig.validators, async ({ params, user }, req, res, next) => {
  try {
    const { teamId } = params;
    const { deletedConfig, affectedIdentitiesCount } = await teamDb.deleteOidcConfiguration(teamId, user.id);
    sendJson(res, { success: true });

    if (deletedConfig) {
      createTeamAuditLog({
        userId: user.id,
        teamId,
        action: AuditLogAction.SSO_OIDC_CONFIG_DELETED,
        resource: AuditLogResource.TEAM_SSO_CONFIG,
        resourceId: deletedConfig.id,
        metadata: { provider: 'OIDC', issuer: deletedConfig.issuer, clientId: deletedConfig.clientId, affectedIdentitiesCount },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string,
      });
    }
  } catch (ex) {
    res.log.error(getErrorMessageAndStackObj(ex), 'Failed to delete OIDC configuration');
    next(ex);
  }
});

const getDomainVerifications = createRoute(routeDefinition.getDomainVerifications.validators, async ({ params }, _req, res, next) => {
  try {
    const { teamId } = params;
    const verifications = await teamDb.getDomainVerifications(teamId);
    sendJson(res, verifications);
  } catch (ex) {
    res.log.error(getErrorMessageAndStackObj(ex), 'Failed to get domain verifications');
    next(ex);
  }
});

const saveDomainVerification = createRoute(
  routeDefinition.saveDomainVerification.validators,
  async ({ params, body, user }, req, res, next) => {
    try {
      const { teamId } = params;
      const { domain } = body;
      if (BLOCKED_PUBLIC_EMAIL_DOMAINS.has(domain)) {
        throw new NotAllowedError('Public email provider domains cannot be claimed for SSO verification');
      }
      const verificationCode = `jetstream-verification=${crypto.randomBytes(16).toString('hex')}`;
      const result = await teamDb.saveDomainVerification(teamId, domain, verificationCode);
      sendJson(res, result);

      createTeamAuditLog({
        userId: user.id,
        teamId,
        action: AuditLogAction.DOMAIN_VERIFICATION_ADDED,
        resource: AuditLogResource.TEAM_DOMAIN_VERIFICATION,
        resourceId: result.id,
        // verificationCode intentionally excluded — it is a shared secret
        metadata: { domain, status: 'PENDING' },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string,
      });
    } catch (ex) {
      res.log.error(getErrorMessageAndStackObj(ex), 'Failed to save domain verification');
      next(ex);
    }
  },
);

const verifyDomain = createRoute(routeDefinition.verifyDomain.validators, async ({ params, user }, req, res, next) => {
  try {
    const { teamId, domainId } = params;
    const verification = await teamDb.getDomainVerification(teamId, domainId);
    if (!verification) {
      throw new NotFoundError('Domain verification request not found');
    }

    let verified = false;
    let verificationMethod: 'dns' | 'file' | null = null;

    // 1. Check DNS TXT record
    try {
      const txtRecords = await dns.resolveTxt(verification.domain);
      const flatRecords = txtRecords.flat();
      if (flatRecords.includes(verification.verificationCode)) {
        verified = true;
        verificationMethod = 'dns';
      }
    } catch (error) {
      res.log.warn({ error: getErrorMessage(error), domain: verification.domain }, 'DNS TXT record lookup failed');
    }

    if (!verified) {
      try {
        const txtRecords = await dns.resolveTxt(`_jetstream.${verification.domain}`);
        const flatRecords = txtRecords.flat();
        if (flatRecords.includes(verification.verificationCode)) {
          verified = true;
          verificationMethod = 'dns';
        }
      } catch (error) {
        res.log.warn({ error: getErrorMessage(error), domain: verification.domain }, 'DNS TXT record lookup failed for fallback');
      }
    }

    // 2. Check File (if not verified by DNS)
    // Validate that the domain resolves to a public IP to prevent SSRF attacks
    let domainIsSafeToFetch = false;
    if (!verified) {
      try {
        await assertDomainResolvesToPublicIp(verification.domain);
        domainIsSafeToFetch = true;
      } catch (error) {
        res.log.warn(
          { error: getErrorMessage(error), domain: verification.domain },
          'Domain failed SSRF safety check, skipping file verification',
        );
      }
    }

    if (!verified && domainIsSafeToFetch) {
      const fileUrls = [
        `https://${verification.domain}/.well-known/jetstream-verification.txt`,
        `https://_jetstream.${verification.domain}/.well-known/jetstream-verification.txt`,
      ];
      for (const fileUrl of fileUrls) {
        if (verified) break;
        try {
          const response = await fetch(fileUrl, { signal: AbortSignal.timeout(5000), redirect: 'manual' });
          if (response.ok) {
            const text = await response.text();
            if (text.trim() === verification.verificationCode) {
              verified = true;
              verificationMethod = 'file';
            }
          }
        } catch (error) {
          res.log.warn({ error: getErrorMessage(error), domain: verification.domain, fileUrl }, 'File verification fetch failed');
        }
      }
    }

    if (verified) {
      const result = await teamDb.verifyDomainVerification(teamId, domainId);
      sendJson(res, { success: true, verification: result });

      createTeamAuditLog({
        userId: user.id,
        teamId,
        action: AuditLogAction.DOMAIN_VERIFIED,
        resource: AuditLogResource.TEAM_DOMAIN_VERIFICATION,
        resourceId: domainId,
        metadata: { domain: verification.domain, method: verificationMethod, verifiedAt: result.verifiedAt },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string,
      });
    } else {
      sendJson(res, { success: false, message: 'Verification failed. Double check your DNS TXT record or file.' });
    }
  } catch (ex) {
    res.log.error(getErrorMessageAndStackObj(ex), 'Failed to verify domain');
    next(ex);
  }
});

const deleteDomainVerification = createRoute(
  routeDefinition.deleteDomainVerification.validators,
  async ({ params, user }, req, res, next) => {
    try {
      const { teamId, domainId } = params;
      const deletedRecord = await teamDb.deleteDomainVerification(teamId, domainId);
      sendJson(res, { success: true });

      createTeamAuditLog({
        userId: user.id,
        teamId,
        action: AuditLogAction.DOMAIN_DELETED,
        resource: AuditLogResource.TEAM_DOMAIN_VERIFICATION,
        resourceId: domainId,
        metadata: {
          domain: deletedRecord.domain,
          wasVerified: deletedRecord.status === 'VERIFIED',
          previousStatus: deletedRecord.status,
        },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string,
      });
    } catch (ex) {
      res.log.error(getErrorMessageAndStackObj(ex), 'Failed to delete domain verification');
      next(ex);
    }
  },
);

const AUDIT_LOG_EXPORT_MAX_DAYS = 365;

const getTeamAuditLogs = createRoute(routeDefinition.getTeamAuditLogs.validators, async ({ params, query }, req, res) => {
  const { teamId } = params;
  const { limit, cursorId, startDate, endDate } = query || {};
  const cursor = cursorId ? { id: cursorId } : undefined;

  const acceptsCsv = req.headers.accept?.includes('text/csv');

  if (acceptsCsv) {
    // Enforce date range for CSV export — cap at 1 year, default to last 30 days
    const effectiveEndDate = endDate ?? new Date();
    const maxStartDate = new Date(effectiveEndDate);
    maxStartDate.setDate(maxStartDate.getDate() - AUDIT_LOG_EXPORT_MAX_DAYS);
    const defaultStartDate = new Date(effectiveEndDate);
    defaultStartDate.setDate(defaultStartDate.getDate() - 30);
    const effectiveStartDate = startDate && startDate >= maxStartDate ? startDate : defaultStartDate;

    const records = await teamService.getTeamAuditLogsForExport({
      teamId,
      startDate: effectiveStartDate,
      endDate: effectiveEndDate,
    });

    const csv = unparse(
      records.map((record) => ({
        date: record.createdAt.toISOString(),
        performedByName: record.user?.name ?? '',
        performedByEmail: record.user?.email ?? '',
        action: record.action,
        resource: record.resource,
        resourceId: record.resourceId ?? '',
        ipAddress: record.ipAddress ?? '',
        metadata: record.metadata ? JSON.stringify(record.metadata) : '',
      })),
      { header: true },
    );

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit-logs-${teamId}.csv"`);
    res.send(csv);
    return;
  }

  const result = await teamService.getTeamAuditLogs({ teamId, limit, cursor, startDate, endDate });
  sendJson(res, {
    ...result,
    records: result.records.map(({ user, ...record }) => ({
      ...record,
      performedBy: user ?? null,
    })),
  });
});
