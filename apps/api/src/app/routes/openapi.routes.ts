import { ENV } from '@jetstream/api-config';
import { HTTP } from '@jetstream/shared/constants';
import express, { Router } from 'express';
import { dump as stringifyYaml } from 'js-yaml';
import z from 'zod';
import { createDocument, ZodOpenApiOperationObject, ZodOpenApiParameters, ZodOpenApiResponsesObject } from 'zod-openapi';
import { routeDefinition as authController } from '../controllers/auth.controller';
import { routeDefinition as billingController } from '../controllers/billing.controller';
import { routeDefinition as dataSyncController } from '../controllers/data-sync.controller';
import { routeDefinition as desktopController } from '../controllers/desktop-app.controller';
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
import { routeDefinition as teamController } from '../controllers/team.controller';
import { routeDefinition as userController } from '../controllers/user.controller';
import { routeDefinition as webExtensionController } from '../controllers/web-extension.controller';
import { basicAuthMiddleware } from './route.middleware';

export const openApiRoutes: express.Router = Router();

// Basic Auth for OpenAPI access
openApiRoutes.use(basicAuthMiddleware);

// /openapi
openApiRoutes.get('/spec.json', (req, res) => {
  const doc = getOpenApiSpec();
  res.setHeader('Content-Type', 'application/json');
  res.json(doc);
});

openApiRoutes.get('/spec.yaml', (req, res) => {
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

function getRequest({
  tags,
  hasSourceOrg = true,
  hasTargetOrg = false,
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
  body?: z.ZodTypeAny;
  params?: z.ZodTypeAny;
  query?: z.ZodTypeAny;
  contentType?: string;
  responseType?: z.ZodTypeAny;
  responseContentType?: string;
}): ZodOpenApiOperationObject {
  const header: Record<string, unknown> = {
    [HTTP.HEADERS.X_CSRF_TOKEN]: z
      .string()
      .optional()
      .meta({
        description: 'CSRF Token for non-get requests. Auth routes include this in the body instead of a header.',
        param: { required: false },
        override: { required: false },
      }),
  };
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
    requestParams.path = params as any;
  }
  if (query) {
    requestParams.query = query as any;
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
export function getOpenApiSpec() {
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
      { description: 'Jetstream Data synchronization', name: 'dataSync' },
      { description: 'Jetstream Organizations', name: 'jetstreamOrganizations' },
      { description: 'Jetstream Redirect', name: 'redirect' },
      { description: 'Jetstream Teams', name: 'team' },
      { description: 'Jetstream Users', name: 'user' },
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
      '/api/me/profile/2fa-otp': {
        get: { ...getRequest({ ...userController.getOtpQrCode.validators, tags: ['user'] }) },
        post: { ...getRequest({ ...userController.saveOtpAuthFactor.validators, tags: ['user'] }) },
      },
      '/api/me/profile/2fa/{type}/{action}': {
        post: { ...getRequest({ ...userController.toggleEnableDisableAuthFactor.validators, tags: ['user'] }) },
      },
      '/api/me/profile/2fa/{type}': {
        delete: { ...getRequest({ ...userController.deleteAuthFactor.validators, tags: ['user'] }) },
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

      // OAuth Controller Routes (prefix: /oauth)
      '/oauth/sfdc/auth': {
        get: { ...getRequest({ ...oauthController.salesforceOauthInitAuth.validators, tags: ['oauth'] }) },
      },
      '/oauth/sfdc/callback': {
        get: { ...getRequest({ ...oauthController.salesforceOauthCallback.validators, tags: ['oauth'] }) },
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
      '/api/teams/{teamId}/invitations': {
        get: { ...getRequest({ ...teamController.getInvitations.validators, tags: ['team'] }) },
        post: { ...getRequest({ ...teamController.createInvitation.validators, tags: ['team'] }) },
      },
      '/api/teams/{teamId}/invitations/{id}': {
        put: { ...getRequest({ ...teamController.resendInvitation.validators, tags: ['team'] }) },
        delete: { ...getRequest({ ...teamController.cancelInvitation.validators, tags: ['team'] }) },
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

      // Web Extension Controller Routes (prefix: /desktop-app)
      '/desktop-app/init': {
        get: { ...getRequest({ ...desktopController.initAuthMiddleware.validators, tags: ['desktop'] }) },
      },
      '/desktop-app/session': {
        get: { ...getRequest({ ...desktopController.initSession.validators, tags: ['desktop'] }) },
      },
      '/desktop-app/verify': {
        post: { ...getRequest({ ...desktopController.verifyTokens.validators, tags: ['desktop'] }) },
      },
      '/desktop-app/logout': {
        delete: { ...getRequest({ ...desktopController.logout.validators, tags: ['desktop'] }) },
      },
      '/desktop-app/data-sync/pull': {
        get: { ...getRequest({ ...desktopController.dataSyncPull.validators, tags: ['desktop'] }) },
      },
      '/desktop-app/data-sync/push': {
        post: { ...getRequest({ ...desktopController.dataSyncPush.validators, tags: ['desktop'] }) },
      },
      '/v1/notifications': {
        post: { ...getRequest({ ...desktopController.notifications.validators, tags: ['desktop'] }) },
      },

      // Web Extension Controller Routes (prefix: /web-extension)
      '/web-extension/init': {
        get: { ...getRequest({ ...webExtensionController.initAuthMiddleware.validators, tags: ['webExtension'] }) },
      },
      '/web-extension/session': {
        get: { ...getRequest({ ...webExtensionController.initSession.validators, tags: ['webExtension'] }) },
      },
      '/web-extension/verify': {
        post: { ...getRequest({ ...webExtensionController.verifyTokens.validators, tags: ['webExtension'] }) },
      },
      '/web-extension/logout': {
        delete: { ...getRequest({ ...webExtensionController.logout.validators, tags: ['webExtension'] }) },
      },
      '/web-extension/data-sync/pull': {
        get: { ...getRequest({ ...webExtensionController.dataSyncPull.validators, tags: ['webExtension'] }) },
      },
      '/web-extension/data-sync/push': {
        post: { ...getRequest({ ...webExtensionController.dataSyncPush.validators, tags: ['webExtension'] }) },
      },
    },
  });
}
