import { createRateLimit, ENV } from '@jetstream/api-config';
import { HTTP } from '@jetstream/shared/constants';
import express, { Router } from 'express';
import { dump as stringifyYaml } from 'js-yaml';
import z, { ZodObject } from 'zod';
import {
  createDocument,
  ZodOpenApiOperationObject,
  ZodOpenApiParameters,
  ZodOpenApiPathItemObject,
  ZodOpenApiResponsesObject,
} from 'zod-openapi';
import { routeDefinition as authController } from '../controllers/auth.controller';
import { routeDefinition as billingController } from '../controllers/billing.controller';
import { routeDefinition as canvasOrgController } from '../controllers/canvas-org.controller';
import { routeDefinition as canvasController } from '../controllers/canvas.controller';
import { routeDefinition as dataSyncController } from '../controllers/data-sync.controller';
import { routeDefinition as desktopController } from '../controllers/desktop-app.controller';
import { routeDefinition as emailChangeController } from '../controllers/email-change.controller';
import { routeDefinition as oauthController } from '../controllers/oauth.controller';
import { routeDefinition as jetstreamOrganizationsController } from '../controllers/org-groups.controller';
import { routeDefinition as orgsController } from '../controllers/orgs.controller';
import { routeDefinition as salesforceApiReqController } from '../controllers/salesforce-api-requests.controller';
import { routeDefinition as bulkApiController } from '../controllers/sf-bulk-api.controller';
import { routeDefinition as bulkQuery20ApiController } from '../controllers/sf-bulk-query-20-api.controller';
import { routeDefinition as metadataToolingController } from '../controllers/sf-metadata-tooling.controller';
import { routeDefinition as miscController } from '../controllers/sf-misc.controller';
import { routeDefinition as queryController } from '../controllers/sf-query.controller';
import { routeDefinition as recordController } from '../controllers/sf-record.controller';
import { routeDefinition as stepUpAuthController } from '../controllers/step-up-auth.controller';
import { routeDefinition as teamController } from '../controllers/team.controller';
import { routeDefinition as userController } from '../controllers/user.controller';
import { routeDefinition as webExtensionController } from '../controllers/web-extension.controller';
import { basicAuthMiddleware } from './route.middleware';

export const openApiRoutes: express.Router = Router();

// Throttle unauthenticated Basic-Auth attempts against /openapi so the static credential cannot be
// brute-forced. Distributed store keeps the ceiling consistent across instances. Runs BEFORE basicAuth.
const openApiRateLimit = createRateLimit(
  'openapi',
  {
    windowMs: 1000 * 60 * 15, // 15 minutes
    limit: ENV.CI || ENV.ENVIRONMENT === 'development' ? 10000 : 30,
  },
  { distributed: true },
);

openApiRoutes.use(openApiRateLimit);

// Basic Auth for OpenAPI access
openApiRoutes.use(basicAuthMiddleware);

// /openapi
openApiRoutes.get('/spec.json', (_, res) => {
  const doc = getOpenApiSpec();
  res.setHeader('Content-Type', 'application/json');
  res.json(doc);
});

openApiRoutes.get('/spec.yaml', (_, res) => {
  const doc = getOpenApiSpec();
  res.setHeader('Content-Type', 'application/x-yaml');
  res.send(stringifyYaml(doc));
});

const responses: ZodOpenApiResponsesObject = {
  200: { description: 'Successful Response' },
  400: {
    description: 'Bad Request',
    headers: z.object({
      [HTTP.HEADERS.X_LOGOUT]: z.literal('1').optional().meta({ description: 'User should be logged out' }),
      [HTTP.HEADERS.X_LOGOUT_URL]: z.string().optional().meta({ description: 'URL to redirect the user to for logout' }),
      [HTTP.HEADERS.X_SFDC_ORG_CONNECTION_ERROR]: z.string().optional().meta({ description: 'Salesforce org is not valid' }),
    }),
  },
  401: {
    description: 'Unauthorized',
    headers: z.object({
      [HTTP.HEADERS.X_LOGOUT]: z.literal('1').optional().meta({ description: 'User should be logged out' }),
      [HTTP.HEADERS.X_LOGOUT_URL]: z.string().optional().meta({ description: 'URL to redirect the user to for logout' }),
    }),
  },
  403: { description: 'Forbidden' },
  404: { description: 'Not Found' },
  500: { description: 'Internal Server Error' },
};

/** For routes that complete by redirecting the browser rather than returning a body */
const redirectResponses: ZodOpenApiResponsesObject = {
  ...responses,
  302: { description: 'Redirect' },
};

/** Multipart form fields for feedback, which is submitted the same way from every platform */
const feedbackRequestBody = z.object({
  message: z.string().min(1).max(5000),
  type: z.enum(['bug', 'feature', 'other', 'testimonial']).optional(),
  url: z.string().optional(),
  language: z.string().optional(),
  clientVersion: z.string().optional(),
  canFeatureTestimonial: z.enum(['true', 'false']).optional(),
  filenames: z.array(z.string()).optional(),
  screenshots: z
    .array(z.string().meta({ format: 'binary' }))
    .max(5)
    .optional()
    .meta({ description: 'Image files (png, jpeg or gif, up to 10MB each). Repeat the field for each file.' }),
});

const canvasAppQuery = z.object({
  _sfdc_canvas_auth: z
    .string()
    .optional()
    .meta({ description: 'user_approval_required starts the OAuth flow for users who are not pre-authorized' }),
  loginUrl: z.string().optional(),
});

const canvasCallbackQuery = z.object({
  code: z.string().optional(),
  state: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional(),
});

const platformEventQuery = z.object({
  [HTTP.HEADERS.X_SFDC_ID]: z
    .string()
    .optional()
    .meta({ description: 'Salesforce org unique id (the header of the same name is also accepted)' }),
  [HTTP.HEADERS.X_SFDC_API_VERSION]: z.string().optional(),
});

const socketIoQuery = z.object({
  EIO: z.string().meta({ description: 'Engine.IO protocol version, 4' }),
  transport: z.enum(['polling', 'websocket']),
  sid: z.string().optional().meta({ description: 'Session id returned by the handshake. Omit on the first request.' }),
});

/** Writes only exist on the polling transport and always belong to an established session */
const socketIoPollingPostQuery = socketIoQuery.extend({
  transport: z.literal('polling'),
  sid: z.string().meta({ description: 'Session id returned by the handshake' }),
});

const cometdMessages = z.array(z.object({ channel: z.string() }).loose());

/**
 * The CometD proxy is mounted with router.use, so every method and any path suffix reaches it. The
 * client only posts to the root path, but both forms are documented so OpenAPI-driven tools exercise them.
 * It has no CSRF check (an Origin allowlist stands in for it), so unlike getRequest it takes no CSRF header.
 */
function getPlatformEventProxyPathItem(hasPathSuffix: boolean): ZodOpenApiPathItemObject {
  const requestParams: ZodOpenApiParameters = {
    header: z.object({
      [HTTP.HEADERS.X_SFDC_ID]: z
        .string()
        .optional()
        .meta({ description: 'Salesforce org unique id. Required as this header or the query parameter.' }),
      [HTTP.HEADERS.X_SFDC_API_VERSION]: z.string().optional(),
    }),
    query: platformEventQuery,
  };
  if (hasPathSuffix) {
    requestParams.path = z.object({ path: z.string().meta({ description: 'Any suffix, which may contain slashes' }) });
  }

  const operation: ZodOpenApiOperationObject = {
    tags: ['platformEvent'],
    summary:
      'Streams the request to /cometd/{apiVersion} on the org instance with its access token and streams the response back. Requires a session and a Salesforce org that belongs to the user. When an Origin header is sent it must match the app origin. Any method and path suffix is proxied; the CometD client posts message batches (handshake, connect, subscribe, ...) to the root path.',
    requestParams,
    responses,
  };
  const operationWithBody: ZodOpenApiOperationObject = {
    ...operation,
    requestBody: { content: { 'application/json': { schema: cometdMessages } } },
  };

  return { get: operation, delete: operation, post: operationWithBody, put: operationWithBody, patch: operationWithBody };
}

function getRequest({
  tags,
  hasSourceOrg = true,
  hasTargetOrg = false,
  hasCsrfHeader = true,
  body,
  params,
  query,
  contentType = 'application/json',
  responseType,
  responseContentType = 'application/json',
}: {
  tags: string[];
  hasSourceOrg?: boolean;
  hasTargetOrg?: boolean;
  /** Set to false for routes that never check a CSRF token (webhooks, proxies, cross-site IdP and Salesforce callbacks) */
  hasCsrfHeader?: boolean;
  body?: z.ZodTypeAny;
  params?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
  contentType?: string;
  responseType?: z.ZodTypeAny;
  responseContentType?: string;
}): ZodOpenApiOperationObject {
  const header: Record<string, unknown> = {};
  if (hasCsrfHeader) {
    header[HTTP.HEADERS.X_CSRF_TOKEN] = z
      .string()
      .optional()
      .meta({
        description: 'CSRF Token for non-get requests. Auth routes include this in the body instead of a header.',
        param: { required: false },
      });
  }
  if (hasSourceOrg) {
    header[HTTP.HEADERS.X_SFDC_ID] = z.string().meta({ description: 'Salesforce Org ID' });
    header[HTTP.HEADERS.X_SFDC_API_VERSION] = z.string().optional().meta({ description: 'Example' });
  }
  if (hasTargetOrg) {
    header[HTTP.HEADERS.X_SFDC_ID_TARGET] = z.string().meta({ description: 'Salesforce Target Org ID' });
    header[HTTP.HEADERS.X_SFDC_API_TARGET_VERSION] = z
      .string()
      .optional()
      .meta({ description: 'Override Salesforce API version for target salesforce org' });
  }
  if (body) {
    header['Content-Type'] = z.enum([contentType]);
  }

  const requestParams: ZodOpenApiParameters = {
    header: z.object(header),
  };

  if (params) {
    requestParams.path = params as unknown as ZodObject;
  }
  if (query) {
    requestParams.query = query as unknown as ZodObject;
  }

  const _responses = { ...responses };
  if (responseType) {
    _responses[200] = {
      description: 'Successful Response',
      content: { [responseContentType]: { schema: responseType } },
    };
  }
  const operation: ZodOpenApiOperationObject = {
    tags,
    requestParams,
    responses: _responses,
  };
  if (body) {
    operation.requestBody = { content: { [contentType]: { schema: body } } };
  }
  return operation;
}

/**
 * Generates the OpenAPI specification for the Jetstream API.
 *
 * These are manually maintained
 */
export function getOpenApiSpec(): ReturnType<typeof createDocument> {
  return createDocument({
    openapi: '3.1.1',
    info: {
      title: 'Jetstream API',
      version: '1.0.0',
      description: 'API documentation for Jetstream',
    },
    servers: [{ url: ENV.JETSTREAM_SERVER_URL }],
    components: {},
    tags: [
      { description: 'Jetstream Authentication', name: 'auth' },
      { description: 'Jetstream Billing and subscription', name: 'billing' },
      { description: 'Salesforce Canvas app entry points and authorized orgs', name: 'canvas' },
      { description: 'Jetstream Data synchronization', name: 'dataSync' },
      { description: 'Jetstream user feedback submissions', name: 'feedback' },
      { description: 'Jetstream Organizations', name: 'jetstreamOrganizations' },
      { description: 'Jetstream Redirect', name: 'redirect' },
      { description: 'Salesforce Platform Event (CometD) proxy', name: 'platformEvent' },
      { description: 'Socket.IO real-time transport', name: 'socket' },
      { description: 'Jetstream Single Sign-On (SAML and OIDC) login, team configuration and domain verification', name: 'sso' },
      { description: 'Jetstream Teams', name: 'team' },
      { description: 'Jetstream Users', name: 'user' },
      { description: 'Inbound webhooks from third-party services (signature verified, no session)', name: 'webhook' },
      { description: 'Salesforce API Requests', name: 'salesforceApiReq' },
      { description: 'Salesforce Bulk API 2.0', name: 'bulkQuery20Api' },
      { description: 'Salesforce Bulk API', name: 'bulkApi' },
      { description: 'Salesforce Metadata and tooling API', name: 'metadataTooling' },
      { description: 'Salesforce miscellaneous actions', name: 'misc' },
      { description: 'Salesforce OAuth', name: 'oauth' },
      { description: 'Salesforce orgs', name: 'orgs' },
      { description: 'Salesforce Records', name: 'record' },
      { description: 'Salesforce SOQL', name: 'query' },
      { description: 'Desktop App', name: 'desktop' },
      { description: 'Web Extension', name: 'webExtension' },
    ],
    paths: {
      // Misc Routes
      '/redirect': {
        get: {
          summary: 'Handle redirects within the application, e.g. after login or team invite',
          tags: ['redirect'],
          requestParams: {
            query: z.object({
              action: z.literal('team-invite').optional(),
              teamId: z.string().optional(),
              token: z.string().optional(),
              email: z.string().optional(),
              redirectUrl: z.string().optional(),
            }),
          },
          responses,
        },
      },

      // Auth Controller Routes (prefix: /api/auth)
      '/api/auth/logout': {
        get: { ...getRequest({ ...authController.logout.validators, tags: ['auth'] }) },
      },
      '/api/auth/providers': {
        get: { ...getRequest({ ...authController.getProviders.validators, tags: ['auth'] }) },
      },
      '/api/auth/csrf': {
        get: { ...getRequest({ ...authController.getCsrfToken.validators, tags: ['auth'] }) },
      },
      '/api/auth/session': {
        get: { ...getRequest({ ...authController.getSession.validators, tags: ['auth'] }) },
      },
      '/api/auth/signin/{provider}': {
        post: {
          ...getRequest({
            ...authController.signin.validators,
            tags: ['auth'],
            contentType: 'application/x-www-form-urlencoded',
          }),
        },
      },
      '/api/auth/callback/{provider}': {
        get: { ...getRequest({ ...authController.callback.validators, tags: ['auth'], body: undefined }) },
        post: {
          ...getRequest({
            ...authController.callback.validators,
            tags: ['auth'],
            contentType: 'application/x-www-form-urlencoded',
          }),
        },
      },
      '/api/auth/verify': {
        post: {
          ...getRequest({
            ...authController.verification.validators,
            tags: ['auth'],
            contentType: 'application/x-www-form-urlencoded',
          }),
        },
      },
      '/api/auth/verify/resend': {
        post: {
          ...getRequest({
            ...authController.resendVerification.validators,
            tags: ['auth'],
            contentType: 'application/x-www-form-urlencoded',
          }),
        },
      },
      '/api/auth/password/reset/init': {
        post: {
          ...getRequest({
            ...authController.requestPasswordReset.validators,
            tags: ['auth'],
            contentType: 'application/x-www-form-urlencoded',
          }),
        },
      },
      '/api/auth/password/reset/verify': {
        post: {
          ...getRequest({
            ...authController.validatePasswordReset.validators,
            tags: ['auth'],
            contentType: 'application/x-www-form-urlencoded',
          }),
        },
      },
      '/api/auth/2fa-otp/enroll': {
        get: { ...getRequest({ ...authController.getOtpEnrollmentData.validators, tags: ['auth'] }) },
        post: {
          ...getRequest({
            ...authController.enrollOtpFactor.validators,
            tags: ['auth'],
            contentType: 'application/x-www-form-urlencoded',
          }),
        },
      },
      '/api/auth/email-change/confirm': {
        post: { ...getRequest({ ...emailChangeController.confirmEmailChangeByToken.validators, tags: ['auth'] }) },
      },
      '/api/auth/email-change/cancel': {
        post: { ...getRequest({ ...emailChangeController.cancelEmailChangeByTokenRoute.validators, tags: ['auth'] }) },
      },

      // SSO Login Flow (prefix: /api/auth/sso) - all unauthenticated
      '/api/auth/sso/discover': {
        post: {
          ...getRequest({ ...authController.discoverSso.validators, tags: ['sso'] }),
          summary:
            'Check whether the email domain has SSO enabled. Returns { data: { available: boolean } }. csrfToken comes from /api/auth/csrf.',
        },
      },
      '/api/auth/sso/start': {
        post: {
          ...getRequest({ ...authController.startSso.validators, tags: ['sso'] }),
          summary:
            'Begin an SSO login for the email domain. Returns { data: { redirectUrl } } for the identity provider. For OIDC the state, PKCE and nonce cookies are set. returnUrl is carried through the login (cookie for OIDC, RelayState for SAML) and validated against the app origin when the login completes.',
        },
      },
      '/api/auth/sso/saml/{teamId}/acs': {
        post: {
          ...getRequest({
            ...authController.handleSamlCallback.validators,
            tags: ['sso'],
            hasCsrfHeader: false,
            contentType: 'application/x-www-form-urlencoded',
          }),
          summary:
            'SAML Assertion Consumer Service. The identity provider form-POSTs the SAMLResponse here; it is validated against the team SAML configuration, then the session is created and the browser is redirected. No CSRF token, the IdP posts cross-site.',
          responses: redirectResponses,
        },
      },
      '/api/auth/sso/saml/{teamId}/metadata': {
        get: {
          ...getRequest({
            ...authController.getSamlMetadata.validators,
            tags: ['sso'],
            responseType: z.string(),
            responseContentType: 'application/xml',
          }),
          summary: 'Service provider SAML metadata XML for the team. Returns a placeholder document if SAML is not configured yet.',
        },
      },
      '/api/auth/sso/oidc/{teamId}/initiate': {
        get: {
          ...getRequest({ ...authController.initiateOidcLogin.validators, tags: ['sso'] }),
          summary:
            'IdP-initiated entry point (e.g. an Okta tile). Starts a service-provider-initiated OIDC flow for the team: sets the state, PKCE and nonce cookies and redirects to the identity provider.',
          responses: redirectResponses,
        },
      },
      '/api/auth/sso/oidc/{teamId}/callback': {
        get: {
          ...getRequest({
            ...authController.handleOidcCallback.validators,
            // The route accepts any query params (z.looseObject) so they pass through to the code exchange,
            // but OpenAPI query params must be named fields, so document the ones the identity provider sends
            query: z.object({
              code: z.string().optional(),
              state: z.string().optional(),
              error: z.string().optional(),
              error_description: z.string().optional(),
            }),
            tags: ['sso'],
          }),
          summary:
            'OIDC redirect URI. Exchanges the authorization code (state, PKCE verifier and nonce are read from the cookies set at the start of the flow), then the session is created and the browser is redirected.',
          responses: redirectResponses,
        },
      },

      // User Controller Routes (prefix: /api)
      '/api/me': {
        get: { ...getRequest({ ...userController.getUserProfile.validators, tags: ['user'] }) },
        delete: { ...getRequest({ ...userController.deleteAccount.validators, tags: ['user'] }) },
      },
      '/api/me/profile': {
        get: { ...getRequest({ ...userController.getFullUserProfile.validators, tags: ['user'] }) },
        post: { ...getRequest({ ...userController.updateProfile.validators, tags: ['user'] }) },
      },
      '/api/me/profile/identity': {
        delete: { ...getRequest({ ...userController.unlinkIdentity.validators, tags: ['user'] }) },
      },
      '/api/me/profile/sessions': {
        get: { ...getRequest({ ...userController.getSessions.validators, tags: ['user'] }) },
        delete: { ...getRequest({ ...userController.revokeAllSessions.validators, tags: ['user'] }) },
      },
      '/api/me/profile/sessions/{id}': {
        delete: { ...getRequest({ ...userController.revokeSession.validators, tags: ['user'] }) },
      },
      '/api/me/profile/password/init': {
        post: { ...getRequest({ ...userController.initPassword.validators, tags: ['user'] }) },
      },
      '/api/me/profile/password/reset': {
        post: { ...getRequest({ ...userController.initResetPassword.validators, tags: ['user'] }) },
      },
      '/api/me/profile/password': {
        delete: { ...getRequest({ ...userController.deletePassword.validators, tags: ['user'] }) },
      },
      '/api/me/profile/login-configuration': {
        get: { ...getRequest({ ...userController.getUserLoginConfiguration.validators, tags: ['user'] }) },
      },
      '/api/me/profile/2fa-otp/begin': {
        post: { ...getRequest({ ...userController.beginOtpEnrollment.validators, tags: ['user'] }) },
      },
      '/api/me/profile/2fa-otp': {
        post: { ...getRequest({ ...userController.saveOtpAuthFactor.validators, tags: ['user'] }) },
      },
      '/api/me/profile/2fa/{type}/{action}': {
        post: { ...getRequest({ ...userController.toggleEnableDisableAuthFactor.validators, tags: ['user'] }) },
      },
      '/api/me/profile/2fa/{type}': {
        delete: { ...getRequest({ ...userController.deleteAuthFactor.validators, tags: ['user'] }) },
      },

      // Step-up authentication and email change (prefix: /api)
      '/api/me/profile/step-up/methods': {
        get: { ...getRequest({ ...stepUpAuthController.getStepUpMethods.validators, tags: ['user'] }) },
      },
      '/api/me/profile/step-up/challenge': {
        post: { ...getRequest({ ...stepUpAuthController.initStepUpChallenge.validators, tags: ['user'] }) },
      },
      '/api/me/profile/step-up/verify': {
        post: { ...getRequest({ ...stepUpAuthController.verifyStepUp.validators, tags: ['user'] }) },
      },
      '/api/me/profile/email-change': {
        get: { ...getRequest({ ...emailChangeController.getEmailChange.validators, tags: ['user'] }) },
        post: { ...getRequest({ ...emailChangeController.requestEmailChange.validators, tags: ['user'] }) },
        delete: { ...getRequest({ ...emailChangeController.cancelEmailChange.validators, tags: ['user'] }) },
      },
      '/api/me/profile/email-change/confirm': {
        post: { ...getRequest({ ...emailChangeController.confirmEmailChangeAuthenticated.validators, tags: ['user'] }) },
      },

      // Data Sync Routes (prefix: /api)
      '/api/data-sync/pull': {
        get: { ...getRequest({ ...dataSyncController.pull.validators, tags: ['dataSync'] }) },
      },
      '/api/data-sync/push': {
        post: { ...getRequest({ ...dataSyncController.push.validators, tags: ['dataSync'] }) },
      },

      // Orgs Controller Routes (prefix: /api)
      '/api/orgs/health-check': {
        post: { ...getRequest({ ...orgsController.checkOrgHealth.validators, tags: ['orgs'] }) },
      },
      '/api/orgs': {
        get: { ...getRequest({ ...orgsController.getOrgs.validators, tags: ['orgs'] }) },
      },
      '/api/orgs/{uniqueId}': {
        patch: { ...getRequest({ ...orgsController.updateOrg.validators, tags: ['orgs'] }) },
        delete: { ...getRequest({ ...orgsController.deleteOrg.validators, tags: ['orgs'] }) },
      },
      '/api/orgs/{uniqueId}/move': {
        put: { ...getRequest({ ...orgsController.moveOrg.validators, tags: ['orgs'] }) },
      },

      // Jetstream Organizations Routes (prefix: /api)
      '/api/orgs/groups': {
        get: {
          ...getRequest({ ...jetstreamOrganizationsController.getOrganizations.validators, tags: ['jetstreamOrganizations'] }),
        },
        post: {
          ...getRequest({ ...jetstreamOrganizationsController.createOrganization.validators, tags: ['jetstreamOrganizations'] }),
        },
      },
      '/api/orgs/groups/{id}': {
        put: {
          ...getRequest({ ...jetstreamOrganizationsController.updateOrganization.validators, tags: ['jetstreamOrganizations'] }),
        },
        delete: {
          ...getRequest({ ...jetstreamOrganizationsController.deleteOrganization.validators, tags: ['jetstreamOrganizations'] }),
        },
      },

      // Canvas Org Routes (prefix: /api) - personal authorized orgs, requires the salesforceCanvas entitlement
      '/api/canvas-orgs': {
        get: {
          ...getRequest({ ...canvasOrgController.getCanvasOrgs.validators, tags: ['canvas'] }),
          summary: 'List the Salesforce orgs the user has authorized to open the Canvas app. Refused when the user is on an active team.',
        },
        post: {
          ...getRequest({ ...canvasOrgController.createCanvasOrg.validators, tags: ['canvas'] }),
          summary: 'Authorize a Salesforce org for the Canvas app. Refused when the user is on an active team.',
        },
      },
      '/api/canvas-orgs/{id}': {
        patch: {
          ...getRequest({ ...canvasOrgController.updateCanvasOrg.validators, tags: ['canvas'] }),
          summary: 'Update an authorized Canvas org. Refused when the user is on an active team.',
        },
        delete: {
          ...getRequest({ ...canvasOrgController.deleteCanvasOrg.validators, tags: ['canvas'] }),
          summary: 'Remove an authorized Canvas org. Refused when the user is on an active team.',
        },
      },

      // Query Controller Routes (prefix: /api)
      '/api/describe': {
        get: { ...getRequest({ ...queryController.describe.validators, tags: ['query'] }) },
      },
      '/api/describe/{sobject}': {
        get: { ...getRequest({ ...queryController.describeSObject.validators, tags: ['query'] }) },
      },
      '/api/query': {
        post: { ...getRequest({ ...queryController.query.validators, tags: ['query'] }) },
      },
      '/api/query-more': {
        get: { ...getRequest({ ...queryController.queryMore.validators, tags: ['query'] }) },
      },

      // Metadata Tooling Controller Routes (prefix: /api)
      '/api/metadata/describe': {
        get: { ...getRequest({ ...metadataToolingController.describeMetadata.validators, tags: ['metadataTooling'] }) },
      },
      '/api/metadata/list': {
        post: { ...getRequest({ ...metadataToolingController.listMetadata.validators, tags: ['metadataTooling'] }) },
      },
      '/api/metadata/read/{type}': {
        post: { ...getRequest({ ...metadataToolingController.readMetadata.validators, tags: ['metadataTooling'] }) },
      },
      '/api/metadata/deploy': {
        post: { ...getRequest({ ...metadataToolingController.deployMetadata.validators, tags: ['metadataTooling'] }) },
      },
      '/api/metadata/deploy-zip': {
        post: { ...getRequest({ ...metadataToolingController.deployMetadataZip.validators, tags: ['metadataTooling'] }) },
      },
      '/api/metadata/deploy/{id}': {
        get: { ...getRequest({ ...metadataToolingController.checkMetadataResults.validators, tags: ['metadataTooling'] }) },
      },
      '/api/metadata/retrieve/list-metadata': {
        post: {
          ...getRequest({
            ...metadataToolingController.retrievePackageFromLisMetadataResults.validators,
            tags: ['metadataTooling'],
          }),
        },
      },
      '/api/metadata/retrieve/package-names': {
        post: {
          ...getRequest({
            ...metadataToolingController.retrievePackageFromExistingServerPackages.validators,
            tags: ['metadataTooling'],
          }),
        },
      },
      '/api/metadata/retrieve/manifest': {
        post: {
          ...getRequest({ ...metadataToolingController.retrievePackageFromManifest.validators, tags: ['metadataTooling'] }),
        },
      },
      '/api/metadata/retrieve/check-results': {
        get: { ...getRequest({ ...metadataToolingController.checkRetrieveStatus.validators, tags: ['metadataTooling'] }) },
      },
      '/api/metadata/retrieve/check-and-redeploy': {
        post: {
          ...getRequest({ ...metadataToolingController.checkRetrieveStatusAndRedeploy.validators, tags: ['metadataTooling'] }),
        },
      },
      '/api/metadata/package-xml': {
        post: { ...getRequest({ ...metadataToolingController.getPackageXml.validators, tags: ['metadataTooling'] }) },
      },
      '/api/apex/anonymous': {
        post: { ...getRequest({ ...metadataToolingController.anonymousApex.validators, tags: ['metadataTooling'] }) },
      },
      '/api/apex/completions/{type}': {
        get: { ...getRequest({ ...metadataToolingController.apexCompletions.validators, tags: ['metadataTooling'] }) },
      },

      // Misc Controller Routes (prefix: /api)
      '/api/file/stream-download': {
        get: { ...getRequest({ ...miscController.streamFileDownload.validators, tags: ['misc'] }) },
      },
      '/api/request': {
        post: { ...getRequest({ ...miscController.salesforceRequest.validators, tags: ['misc'] }) },
      },
      '/api/request-manual': {
        post: { ...getRequest({ ...miscController.salesforceRequestManual.validators, tags: ['misc'] }) },
      },

      // Record Controller Routes (prefix: /api)
      '/api/record/upload': {
        post: {
          ...getRequest({ ...recordController.binaryUpload.validators, tags: ['record'], contentType: 'multipart/form-data' }),
        },
      },
      '/api/record/{operation}/{sobject}': {
        post: { ...getRequest({ ...recordController.recordOperation.validators, tags: ['record'] }) },
      },

      // Bulk API Controller Routes (prefix: /api)
      '/api/bulk': {
        post: { ...getRequest({ ...bulkApiController.createJob.validators, tags: ['bulkApi'] }) },
      },
      '/api/bulk/{jobId}': {
        get: { ...getRequest({ ...bulkApiController.getJob.validators, tags: ['bulkApi'] }) },
        post: { ...getRequest({ ...bulkApiController.addBatchToJob.validators, tags: ['bulkApi'] }) },
      },
      '/api/bulk/{jobId}/{action}': {
        delete: { ...getRequest({ ...bulkApiController.closeOrAbortJob.validators, tags: ['bulkApi'] }) },
      },
      '/api/bulk/zip/{jobId}': {
        post: {
          ...getRequest({
            ...bulkApiController.addBatchToJobWithBinaryAttachment.validators,
            tags: ['bulkApi'],
            contentType: 'application/zip',
          }),
        },
      },
      '/api/bulk/download-all/{jobId}': {
        get: { ...getRequest({ ...bulkApiController.downloadAllResults.validators, tags: ['bulkApi'] }) },
      },
      '/api/bulk/{jobId}/{batchId}': {
        get: {
          ...getRequest({ ...bulkApiController.downloadResults.validators, tags: ['bulkApi'], responseContentType: 'text/csv' }),
        },
      },

      // Bulk Query 2.0 API Controller Routes (prefix: /api)
      '/api/bulk-query': {
        post: { ...getRequest({ ...bulkQuery20ApiController.createJob.validators, tags: ['bulkQuery20Api'] }) },
        get: { ...getRequest({ ...bulkQuery20ApiController.getJobs.validators, tags: ['bulkQuery20Api'] }) },
      },
      '/api/bulk-query/{jobId}/results': {
        get: { ...getRequest({ ...bulkQuery20ApiController.downloadResults.validators, tags: ['bulkQuery20Api'] }) },
      },
      '/api/bulk-query/{jobId}': {
        get: { ...getRequest({ ...bulkQuery20ApiController.getJob.validators, tags: ['bulkQuery20Api'] }) },
        delete: { ...getRequest({ ...bulkQuery20ApiController.deleteJob.validators, tags: ['bulkQuery20Api'] }) },
      },
      '/api/bulk-query/{jobId}/abort': {
        post: { ...getRequest({ ...bulkQuery20ApiController.abortJob.validators, tags: ['bulkQuery20Api'] }) },
      },

      // Salesforce API Requests Controller Routes (prefix: /api)
      '/api/salesforce-api/requests': {
        get: { ...getRequest({ ...salesforceApiReqController.getSalesforceApiRequests.validators, tags: ['salesforceApiReq'] }) },
      },

      // Feedback (prefix: /api)
      '/api/feedback': {
        post: {
          ...getRequest({ body: feedbackRequestBody, hasSourceOrg: false, contentType: 'multipart/form-data', tags: ['feedback'] }),
          summary:
            'Submit feedback with up to 5 screenshots, which is emailed to the Jetstream team. Rate limited per user (5 per 15 minutes). The desktop app and web extension use /desktop-app/feedback and /web-extension/feedback.',
        },
      },

      // OAuth Controller Routes (prefix: /oauth)
      '/oauth/sfdc/auth': {
        get: { ...getRequest({ ...oauthController.salesforceOauthInitAuth.validators, tags: ['oauth'] }) },
      },
      '/oauth/sfdc/callback': {
        get: {
          ...getRequest({
            ...oauthController.salesforceOauthCallback.validators,
            // The route accepts any query params (z.record) so they can be passed through to the token exchange,
            // but OpenAPI query params must be named fields, so document the ones Salesforce sends
            query: z.object({
              code: z.string().optional(),
              state: z.string().optional(),
              error: z.string().optional(),
              error_description: z.string().optional(),
            }),
            tags: ['oauth'],
          }),
        },
      },

      // Static Authenticated Routes (prefix: /static)
      '/static/sfdc/login': {
        get: { ...getRequest({ ...miscController.getFrontdoorLoginUrl.validators, tags: ['misc'] }) },
      },
      '/static/bulk/{jobId}/{batchId}/file': {
        get: { ...getRequest({ ...bulkApiController.downloadResultsFile.validators, tags: ['bulkApi'] }) },
      },

      // Team Controller Routes (prefix: /api/teams)
      '/api/teams/{teamId}/invitations/{token}/verify': {
        get: { ...getRequest({ ...teamController.verifyInvitation.validators, tags: ['team'] }) },
      },
      '/api/teams/{teamId}/invitations/{token}/accept': {
        post: { ...getRequest({ ...teamController.acceptInvitation.validators, tags: ['team'] }) },
      },
      '/api/teams/{teamId}': {
        get: { ...getRequest({ ...teamController.getTeam.validators, tags: ['team'] }) },
        put: { ...getRequest({ ...teamController.updateTeam.validators, tags: ['team'] }) },
      },
      '/api/teams/{teamId}/sessions': {
        get: { ...getRequest({ ...teamController.getUserSessions.validators, tags: ['team'] }) },
      },
      '/api/teams/{teamId}/sessions/{sessionId}': {
        delete: { ...getRequest({ ...teamController.revokeUserSession.validators, tags: ['team'] }) },
      },
      '/api/teams/{teamId}/auth-activity': {
        get: { ...getRequest({ ...teamController.getUserAuthActivity.validators, tags: ['team'] }) },
      },
      '/api/teams/{teamId}/login-configuration': {
        post: { ...getRequest({ ...teamController.updateLoginConfiguration.validators, tags: ['team'] }) },
      },
      '/api/teams/{teamId}/members/{userId}': {
        put: { ...getRequest({ ...teamController.updateTeamMember.validators, tags: ['team'] }) },
      },
      '/api/teams/{teamId}/members/{userId}/status': {
        put: { ...getRequest({ ...teamController.updateTeamMemberStatusAndRole.validators, tags: ['team'] }) },
      },
      '/api/teams/{teamId}/seats/preview': {
        post: { ...getRequest({ ...teamController.previewSeatChange.validators, tags: ['team'] }) },
      },
      '/api/teams/{teamId}/seats': {
        put: { ...getRequest({ ...teamController.updateSeats.validators, tags: ['team'] }) },
      },
      '/api/teams/{teamId}/invitations': {
        get: { ...getRequest({ ...teamController.getInvitations.validators, tags: ['team'] }) },
        post: { ...getRequest({ ...teamController.createInvitation.validators, tags: ['team'] }) },
      },
      '/api/teams/{teamId}/invitations/{id}': {
        put: { ...getRequest({ ...teamController.resendInvitation.validators, tags: ['team'] }) },
        delete: { ...getRequest({ ...teamController.cancelInvitation.validators, tags: ['team'] }) },
      },

      // Team SSO Configuration Routes (prefix: /api/teams)
      '/api/teams/{teamId}/sso/config': {
        get: {
          ...getRequest({ ...teamController.getSsoConfig.validators, tags: ['sso'] }),
          summary: 'Get the team SSO configuration (SAML and OIDC) with secrets masked. Team roles: ADMIN, BILLING.',
        },
      },
      '/api/teams/{teamId}/sso/saml/parse-metadata': {
        post: {
          ...getRequest({ ...teamController.parseSamlMetadata.validators, tags: ['sso'] }),
          summary:
            'Parse identity provider SAML metadata supplied as XML or fetched server-side from a URL. Returns the extracted IdP settings without saving. Team roles: ADMIN.',
        },
      },
      '/api/teams/{teamId}/sso/saml/config': {
        post: {
          ...getRequest({ ...teamController.createOrUpdateSamlConfig.validators, tags: ['sso'] }),
          summary: 'Create or update the SAML configuration. Requires at least one verified domain. Team roles: ADMIN.',
        },
        delete: {
          ...getRequest({ ...teamController.deleteSamlConfig.validators, tags: ['sso'] }),
          summary: 'Delete the SAML configuration. Team roles: ADMIN.',
        },
      },
      '/api/teams/{teamId}/sso/oidc/config': {
        post: {
          ...getRequest({ ...teamController.createOrUpdateOidcConfig.validators, tags: ['sso'] }),
          summary:
            'Create or update the OIDC configuration. Only the issuer is needed, the endpoints are discovered server-side from the issuer. Requires at least one verified domain. Team roles: ADMIN.',
        },
        delete: {
          ...getRequest({ ...teamController.deleteOidcConfig.validators, tags: ['sso'] }),
          summary: 'Delete the OIDC configuration. Team roles: ADMIN.',
        },
      },
      '/api/teams/{teamId}/sso/settings': {
        put: {
          ...getRequest({ ...teamController.updateSsoSettings.validators, tags: ['sso'] }),
          summary: 'Enable or disable SSO, JIT provisioning and the SSO bypass (and which roles may bypass). Team roles: ADMIN.',
        },
      },
      '/api/teams/{teamId}/domain-verification': {
        get: {
          ...getRequest({ ...teamController.getDomainVerifications.validators, tags: ['sso'] }),
          summary: 'List the domains claimed by the team and their verification status. Team roles: ADMIN, BILLING.',
        },
        post: {
          ...getRequest({ ...teamController.saveDomainVerification.validators, tags: ['sso'] }),
          summary:
            'Claim a domain and get the verification code. Ownership is proven with a DNS TXT record (apex or _jetstream. subdomain) or a file at https://{domain}/.well-known/jetstream-verification.txt. Public email provider domains are rejected. Team roles: ADMIN.',
        },
      },
      '/api/teams/{teamId}/domain-verification/{domainId}/verify': {
        post: {
          ...getRequest({ ...teamController.verifyDomain.validators, tags: ['sso'] }),
          summary: 'Check the DNS record or hosted file for the claimed domain and mark it verified. Team roles: ADMIN.',
        },
      },
      '/api/teams/{teamId}/domain-verification/{domainId}': {
        delete: {
          ...getRequest({ ...teamController.deleteDomainVerification.validators, tags: ['sso'] }),
          summary: 'Remove a claimed domain. Team roles: ADMIN.',
        },
      },

      // Team Audit Logs and Canvas Orgs (prefix: /api/teams)
      '/api/teams/{teamId}/audit-logs': {
        get: {
          ...getRequest({ ...teamController.getTeamAuditLogs.validators, tags: ['team'] }),
          summary: 'Page through the team audit log, newest first (cursorId pages, limit is 1-100). Team roles: ADMIN.',
        },
      },
      '/api/teams/{teamId}/canvas-orgs': {
        get: {
          ...getRequest({ ...teamController.getCanvasOrgs.validators, tags: ['canvas'] }),
          summary: 'List the Salesforce orgs the team has authorized to open the Canvas app. Team roles: ADMIN, BILLING.',
        },
        post: {
          ...getRequest({ ...teamController.createCanvasOrg.validators, tags: ['canvas'] }),
          summary: 'Authorize a Salesforce org for the Canvas app on behalf of the team. Team roles: ADMIN.',
        },
      },
      '/api/teams/{teamId}/canvas-orgs/{id}': {
        patch: {
          ...getRequest({ ...teamController.updateCanvasOrg.validators, tags: ['canvas'] }),
          summary: 'Update a team authorized Canvas org. Team roles: ADMIN.',
        },
        delete: {
          ...getRequest({ ...teamController.deleteCanvasOrg.validators, tags: ['canvas'] }),
          summary: 'Remove a team authorized Canvas org. Team roles: ADMIN.',
        },
      },

      // Billing Controller Routes (prefix: /api/billing)
      '/api/billing/checkout-session': {
        post: { ...getRequest({ ...billingController.createCheckoutSession.validators, tags: ['billing'] }) },
      },
      '/api/billing/checkout-session/{action}': {
        get: { ...getRequest({ ...billingController.processCheckoutSuccess.validators, tags: ['billing'] }) },
      },
      '/api/billing/subscriptions': {
        get: { ...getRequest({ ...billingController.getSubscriptions.validators, tags: ['billing'] }) },
      },
      '/api/billing/portal': {
        post: { ...getRequest({ ...billingController.createBillingPortalSession.validators, tags: ['billing'] }) },
      },

      // Desktop App Controller Routes (prefix: /desktop-app)
      '/desktop-app/auth/session': {
        post: { ...getRequest({ ...desktopController.initSession.validators, tags: ['desktop'] }) },
      },
      '/desktop-app/auth/verify': {
        post: { ...getRequest({ ...desktopController.verifyToken.validators, tags: ['desktop'] }) },
      },
      '/desktop-app/auth/logout': {
        delete: { ...getRequest({ ...desktopController.logout.validators, tags: ['desktop'] }) },
      },
      '/desktop-app/data-sync/pull': {
        get: { ...getRequest({ ...desktopController.dataSyncPull.validators, tags: ['desktop'] }) },
      },
      '/desktop-app/data-sync/push': {
        post: { ...getRequest({ ...desktopController.dataSyncPush.validators, tags: ['desktop'] }) },
      },
      '/desktop-app/v1/notifications': {
        get: { ...getRequest({ ...desktopController.notifications.validators, tags: ['desktop'] }) },
      },
      '/desktop-app/feedback': {
        post: {
          ...getRequest({ body: feedbackRequestBody, hasSourceOrg: false, contentType: 'multipart/form-data', tags: ['desktop'] }),
          summary: 'Submit feedback from the desktop app. Authenticated with the desktop bearer token. Rate limited per user.',
        },
      },

      // Web Extension Controller Routes (prefix: /web-extension)
      '/web-extension/auth/session': {
        post: { ...getRequest({ ...webExtensionController.initSession.validators, tags: ['webExtension'] }) },
      },
      '/web-extension/auth/verify': {
        post: { ...getRequest({ ...webExtensionController.verifyToken.validators, tags: ['webExtension'] }) },
      },
      '/web-extension/auth/logout': {
        delete: { ...getRequest({ ...webExtensionController.logout.validators, tags: ['webExtension'] }) },
      },
      '/web-extension/data-sync/pull': {
        get: { ...getRequest({ ...webExtensionController.dataSyncPull.validators, tags: ['webExtension'] }) },
      },
      '/web-extension/data-sync/push': {
        post: { ...getRequest({ ...webExtensionController.dataSyncPush.validators, tags: ['webExtension'] }) },
      },
      '/web-extension/feedback': {
        post: {
          ...getRequest({ body: feedbackRequestBody, hasSourceOrg: false, contentType: 'multipart/form-data', tags: ['webExtension'] }),
          summary: 'Submit feedback from the web extension. Authenticated with the extension bearer token. Rate limited per user.',
        },
      },

      // Canvas App (prefix: /canvas) - framed by Salesforce, authenticated by the Canvas signed request rather than a session
      '/canvas/app': {
        get: {
          ...getRequest({
            ...canvasController.appHandler.validators,
            tags: ['canvas'],
            hasCsrfHeader: false,
            body: undefined,
            query: canvasAppQuery,
            responseType: z.string(),
            responseContentType: 'text/html',
          }),
          summary:
            'Canvas app entry for the user_approval_required flow. Validates loginUrl (https, *.salesforce.com) and returns the Canvas app HTML with the Salesforce OAuth authorization URL.',
        },
        post: {
          ...getRequest({
            ...canvasController.appHandler.validators,
            tags: ['canvas'],
            hasCsrfHeader: false,
            body: z.object({ signed_request: z.string().optional() }),
            query: canvasAppQuery,
            contentType: 'application/x-www-form-urlencoded',
            responseType: z.string(),
            responseContentType: 'text/html',
          }),
          summary:
            'Canvas app entry. Salesforce posts a signed_request (HMAC-signed with the Canvas consumer secret). Once verified, the org must be authorized for Canvas (403 otherwise) and the Canvas app HTML is returned. Static assets under /canvas are served only to Salesforce or same-host Origin/Referer values.',
        },
      },
      '/canvas/callback': {
        get: {
          ...getRequest({
            ...canvasController.callbackHandler.validators,
            tags: ['canvas'],
            hasCsrfHeader: false,
            query: canvasCallbackQuery,
          }),
          summary:
            'Canvas OAuth redirect URI, used when a user is not pre-authorized. Completes the authorization-code exchange and redirects to /canvas-auth/ with success or error query params.',
          responses: redirectResponses,
        },
        post: {
          ...getRequest({
            ...canvasController.callbackHandler.validators,
            tags: ['canvas'],
            hasCsrfHeader: false,
            query: canvasCallbackQuery,
          }),
          summary: 'Same handler as the GET callback.',
          responses: redirectResponses,
        },
      },

      // Platform Event proxy (prefix: /platform-event) - cookie session, outside /api so there is no CSRF token check
      '/platform-event': getPlatformEventProxyPathItem(false),
      '/platform-event/{path}': getPlatformEventProxyPathItem(true),

      // Webhooks (prefix: /webhook) - raw JSON body, authenticated by the sender signature, no session or CSRF token
      '/webhook/stripe': {
        post: {
          tags: ['webhook'],
          summary: 'Stripe webhook receiver. The raw body is verified against the Stripe-Signature header. Rate limited by IP.',
          requestParams: { header: z.object({ 'Stripe-Signature': z.string() }) },
          requestBody: { content: { 'application/json': { schema: z.looseObject({ id: z.string(), type: z.string() }) } } },
          responses: {
            200: { description: 'Event accepted' },
            400: { description: 'Missing or invalid signature, or the event could not be processed' },
          },
        },
      },
      '/webhook/mailgun': {
        post: {
          tags: ['webhook'],
          summary:
            'Mailgun event webhook. The signature block is checked against the signing key (HMAC of timestamp and token), the timestamp must be within 15 minutes, and each token can be used once. Rate limited by IP.',
          requestBody: {
            content: {
              'application/json': {
                schema: z.object({
                  signature: z.object({ timestamp: z.string(), token: z.string(), signature: z.string() }),
                  'event-data': z.looseObject({ event: z.string(), timestamp: z.number(), recipient: z.string() }),
                }),
              },
            },
          },
          responses: {
            200: { description: 'Event stored' },
            400: { description: 'Invalid payload' },
            403: { description: 'Timestamp outside the allowed window, invalid signature or token already used' },
            500: { description: 'Webhook signing key not configured' },
          },
        },
      },

      // Socket.IO (path: /socket.io/) - the Engine.IO HTTP transport; events travel over the socket after the handshake
      '/socket.io/': {
        get: {
          tags: ['socket'],
          summary:
            'Engine.IO handshake, polling and WebSocket upgrade. Browsers authenticate with the session cookie and an Origin that matches the app. The desktop app (X-Source: desktop) and the web extension (extension Origin) send an Authorization bearer token and device identifier in the Socket.IO handshake auth payload instead. Sessions with an unfinished sign in are refused.',
          requestParams: { query: socketIoQuery },
          responses,
        },
        post: {
          tags: ['socket'],
          summary: 'Engine.IO long-polling write for an established sid. WebSocket messages travel on the upgraded connection instead.',
          requestParams: { query: socketIoPollingPostQuery },
          responses,
        },
      },
    },
  });
}
