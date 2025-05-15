import { ApiConnection, getApiRequestFactoryFn } from '@jetstream/salesforce-api';
import { ERROR_MESSAGES, HTTP } from '@jetstream/shared/constants';
import { ensureBoolean, getErrorMessage } from '@jetstream/shared/utils';
import { Maybe, SalesforceOrgUi } from '@jetstream/types';
import { safeStorage } from 'electron';
import logger from 'electron-log';
import { z } from 'zod';
import { ENV } from '../config/environment';
import { getSalesforceOrgById, updateAccessTokens, updateSalesforceOrg_UNSAFE } from '../services/persistence.service';

export interface RequestOptions {
  request: Request;
  params: Record<string, string>;
  // user: SalesforceOrgUi;
  jetstreamConn?: ApiConnection;
  targetJetstreamConn?: Maybe<ApiConnection>;
  org?: SalesforceOrgUi;
  targetOrg?: SalesforceOrgUi;
  /**
   * Override the URL for the request
   * This is used for streaming file downloads
   */
  urlOverride?: URL;
}

export type ControllerFunction<TParamsSchema extends z.ZodTypeAny, TBodySchema extends z.ZodTypeAny, TQuerySchema extends z.ZodTypeAny> = (
  data: {
    params: z.infer<TParamsSchema>;
    body: z.infer<TBodySchema>;
    query: z.infer<TQuerySchema>;
    jetstreamConn?: ApiConnection;
    targetJetstreamConn?: Maybe<ApiConnection>;
    // user: SalesforceOrgUi;// TODO:
    // requestId: string;
    org?: SalesforceOrgUi;
    targetOrg?: SalesforceOrgUi;
  },
  req: RequestOptions
) => Promise<Response> | Response;

export function createRoute<TParamsSchema extends z.ZodTypeAny, TBodySchema extends z.ZodTypeAny, TQuerySchema extends z.ZodTypeAny>(
  {
    params,
    body,
    query,
    hasSourceOrg = true,
    hasTargetOrg = false,
  }: {
    params?: TParamsSchema;
    body?: TBodySchema;
    query?: TQuerySchema;
    /**
     * Set to false to skip validating that an org exists on the request
     * @default true
     */
    hasSourceOrg?: boolean;
    hasTargetOrg?: boolean;
  },
  controllerFn: ControllerFunction<TParamsSchema, TBodySchema, TQuerySchema>
) {
  return async (req: RequestOptions) => {
    const url = req.urlOverride || new URL(req.request.url);
    const queryParams = Object.fromEntries(url.searchParams.entries());

    let parsedBody: unknown = undefined;

    if (req.request.method !== 'GET') {
      if (req.request.headers.get('content-type') === 'application/json') {
        try {
          parsedBody = await req.request.json();
        } catch (ex) {
          // headers may not have been correct, just ignore and continue
        }
      } else if (req.request.headers.get('content-type') === 'application/zip') {
        parsedBody = await req.request.arrayBuffer();
      } else {
        parsedBody = await req.request.text();
      }
    }

    try {
      const data = {
        params: params ? params.parse(req.params) : undefined,
        body: body && parsedBody ? body.parse(parsedBody) : undefined,
        query: query ? query.parse(queryParams) : undefined,
        jetstreamConn: req.jetstreamConn,
        targetJetstreamConn: req.targetJetstreamConn,
        org: req.org,
        // this will exist if targetJetstreamConn exists, otherwise will throw
        targetOrg: req.targetOrg,
      };
      if (hasSourceOrg && !data.jetstreamConn) {
        logger.info('[INIT-ORG][ERROR] A source org did not exist on the request');
        throw new Error('An org is required for this action');
      }
      if (hasTargetOrg && !data.targetJetstreamConn) {
        logger.info('[INIT-ORG][ERROR] A target org did not exist on locals');
        throw new Error('A source and target org are required for this action');
      }
      return await controllerFn(data, req);
    } catch (ex) {
      logger.error(ex, '[ROUTE][VALIDATION ERROR]');
      throw ex;
    }
  };
}

export function handleJsonResponse(data?: any, options: ResponseInit = {}) {
  return new Response(JSON.stringify({ data: data || {} }), {
    headers: {
      'Content-Type': 'application/json',
    },
    status: 200,
    statusText: 'OK',
    ...options,
  });
}

export function handleErrorResponse(error: Error, additionalHeaders?: Record<string, string>) {
  logger.error('[ROUTE][ERROR]', error);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...additionalHeaders,
  };
  const errorMessage = getErrorMessage(error);
  if (
    errorMessage === ERROR_MESSAGES.SFDC_EXPIRED_TOKEN ||
    errorMessage === ERROR_MESSAGES.SFDC_EXPIRED_TOKEN_VALIDITY ||
    ERROR_MESSAGES.SFDC_ORG_DOES_NOT_EXIST.test(errorMessage)
  ) {
    headers[HTTP.HEADERS.X_SFDC_ORG_CONNECTION_ERROR] = ERROR_MESSAGES.SFDC_EXPIRED_TOKEN;
  }

  return new Response(
    JSON.stringify({
      error: true,
      message: errorMessage,
    }),
    { status: 400, statusText: 'Bad Request', headers }
  );
}

export function getOrgFromHeaderOrQuery(req: Request, headerKey: string, versionHeaderKey: string) {
  const query = new URLSearchParams(req.url.split('?')[1]);
  const uniqueId = (req.headers.get(headerKey) || query.get(headerKey)) as string;

  const apiVersion = (req.headers.get(versionHeaderKey) || query.get(versionHeaderKey)) as string | undefined;
  const includeCallOptions = ensureBoolean(
    req.headers.get(HTTP.HEADERS.X_INCLUDE_CALL_OPTIONS) || (query.get('includeCallOptions') as string | undefined)
  );

  if (!uniqueId) {
    return;
  }

  return initApiConnection(uniqueId, { includeCallOptions, apiVersion });
}

export function initApiConnection(
  uniqueId: string,
  { apiVersion, includeCallOptions }: { apiVersion?: string; includeCallOptions?: boolean } = {}
) {
  const org = getSalesforceOrgById(uniqueId);

  if (!org) {
    return;
  }

  apiVersion = apiVersion || org.apiVersion || ENV.SFDC_API_VERSION;

  let callOptions: Record<string, string> = {
    client: 'jetstream-desktop',
  };

  if (org.orgNamespacePrefix && includeCallOptions) {
    callOptions = { ...callOptions, defaultNamespace: org.orgNamespacePrefix };
  }

  const [accessToken, refreshToken] = safeStorage.decryptString(Buffer.from(org.accessToken, 'base64')).split(' ');

  const handleRefresh = async (accessToken: string, refreshToken: string) => {
    // Refresh event will be fired when renewed access token
    // to store it in your storage for next request
    try {
      if (!refreshToken) {
        return;
      }
      await updateAccessTokens(org.uniqueId, { accessToken, refreshToken });
    } catch (ex) {
      logger.error('[ORG][REFRESH] Error saving refresh token', getErrorMessage(ex));
    }
  };

  const handleConnectionError = async (connectionError: string) => {
    try {
      await updateSalesforceOrg_UNSAFE(org.uniqueId, { connectionError });
    } catch (ex) {
      logger.error('[ORG][UPDATE] Error updating connection error on org', getErrorMessage(ex));
    }
  };

  const jetstreamConn = new ApiConnection(
    {
      apiRequestAdapter: getApiRequestFactoryFn(fetch),
      userId: org.userId,
      organizationId: org.organizationId,
      accessToken,
      apiVersion,
      callOptions,
      instanceUrl: org.instanceUrl,
      refreshToken,
      logger: logger as any,
      logging: ENV.LOG_LEVEL === 'debug',
      sfdcClientId: ENV.DESKTOP_SFDC_CLIENT_ID,
    },
    handleRefresh,
    handleConnectionError
  );

  return { org, jetstreamConn };
}
