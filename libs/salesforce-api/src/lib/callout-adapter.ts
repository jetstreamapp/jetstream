import { ERROR_MESSAGES, HTTP } from '@jetstream/shared/constants';
import { getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import { parse } from '@jetstreamapp/simple-xml';
import isObject from 'lodash/isObject';
import { ApiRequestOptions, ApiRequestOutputType, BulkXmlErrorResponse, FetchFn, FetchResponse, Logger, SoapErrorResponse } from './types';

const SOAP_API_AUTH_ERROR_REGEX = /<faultcode>[a-zA-Z]+:INVALID_SESSION_ID<\/faultcode>/;
// Shows up for certain API requests, such as Identity
const BAS_ACCESS_TOKEN_403 = 'Bad_OAuth_Token';

export class ApiRequestError extends Error {
  readonly status: number;
  readonly statusText?: string;
  readonly ok: boolean;
  readonly headers: Headers;
  readonly type: string;

  constructor(message: string | undefined, response: FetchResponse<unknown>) {
    super(message);
    if (response) {
      this.status = response.status;
      this.statusText = response.statusText;
      this.ok = response.ok;
      this.headers = response.headers;
      this.type = response.type;
    }
  }
}

/**
 * Resolves the outbound request URL against the org's `instanceUrl` and asserts it stays on the
 * same origin over HTTPS before we attach the session's bearer/`X-SFDC-Session`. `url` on the
 * manual-request and stream-download endpoints is fully caller-controlled, so a value like
 * `@evil.com/x`, `//evil.com`, `https://evil.com`, or one using userinfo/backslash tricks could
 * otherwise override the authority and exfiltrate the org's credentials to an attacker host.
 *
 * Resolving with `new URL(url, instanceUrl)` and pinning `resolved.origin === instance origin`
 * neutralizes all of those regardless of the underlying fetch/undici runtime, and returning the
 * resolved string means the actual fetch parses the exact same value we validated.
 */
export function resolveSameOriginRequestUrl(url: string, instanceUrl: string): string {
  const instanceOrigin = new URL(instanceUrl).origin;
  const resolved = new URL(url, instanceUrl);
  if (resolved.origin !== instanceOrigin || resolved.protocol !== 'https:') {
    throw new Error(`Request URL must stay on the Salesforce instance origin over HTTPS: ${url}`);
  }
  return resolved.toString();
}

export const CALLOUT_ADAPTER_PARSE_OPTIONS = {
  trimValues: true,
  ignoreAttributes: false,
  removeNSPrefix: true,
  attributeNamePrefix: '@_',
  processEntities: false,
  parseTagValue: true,
} as const;

function parseXml(value: string) {
  return parse(value, CALLOUT_ADAPTER_PARSE_OPTIONS);
}

// Headers that must always come from the server-bound session — caller-supplied values are dropped
// so the proxy cannot be coerced into using a different bearer/session/cookie/host.
const DENIED_CALLER_HEADERS = new Set(['authorization', 'cookie', 'host', 'x-sfdc-session']);

export function sanitizeCallerHeaders(headers: Record<string, string> | undefined): Record<string, string> | undefined {
  if (!headers) {
    return headers;
  }
  const sanitized: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (!DENIED_CALLER_HEADERS.has(name.toLowerCase())) {
      sanitized[name] = value;
    }
  }
  return sanitized;
}

export interface RefreshedTokens {
  accessToken: string;
  refreshToken: string;
}

/**
 * Caller-supplied refresh orchestrator. Owns:
 *  - cross-process coordination (e.g. Postgres advisory lock on web; in-memory check on desktop)
 *  - the optimistic re-read against the source of truth
 *  - the Salesforce `exchangeRefreshToken` call (only when this caller is the chosen refresher)
 *  - persistence of the rotated tokens
 *
 * Invoked at most once per `(userId, organizationId)` per process via the in-process single-flight
 * cache below — concurrent callers within the same process share the same in-flight promise.
 */
export type RefreshTokensFn = (currentAccessToken: string) => Promise<RefreshedTokens>;

export interface ApiRequestFactoryOptions {
  logger?: Logger;
  /**
   * Primary refresh entrypoint. When provided, takes precedence over the legacy `onRefresh`
   * path and is wrapped in an in-process single-flight cache so that N concurrent 401s on the
   * same connection collapse to one Salesforce token exchange.
   */
  refreshTokens?: RefreshTokensFn;
  onConnectionError?: (error: string) => void;
  /** Trace-level request/response body logging. Refresh-flow logs are always emitted. */
  enableLogging?: boolean;
  /**
   * Defense-in-depth fallback. Only fires when `refreshTokens` is not provided AND the
   * legacy `onRefresh` path's Salesforce call rejected (i.e. another worker won the rotation
   * race before this one wrote). Returns the canonical tokens from the source of truth so
   * the loser can retry without re-calling Salesforce.
   */
  getFreshTokens?: () => Promise<RefreshedTokens | null>;
  /**
   * @deprecated Use `refreshTokens` instead. Retained for callers that have not yet migrated
   * to the single-flight refresh pattern. Will be removed once all callers are migrated.
   */
  onRefresh?: (accessToken: string, refreshToken?: string, skipPersistence?: boolean) => Promise<void> | void;
}

/**
 * Per-process single-flight cache keyed by `${userId}::${organizationId}`. While a refresh is
 * in flight for a key, concurrent 401 handlers on the same connection (e.g. Promise.all over
 * batched metadata reads) all await the same promise instead of each calling Salesforce —
 * which would invalidate every loser's refresh token under refresh-token-rotation.
 */
const REFRESH_IN_FLIGHT = new Map<string, Promise<RefreshedTokens>>();

function singleFlightKey(userId: string, organizationId: string): string {
  return `${userId}::${organizationId}`;
}

async function runSingleFlightRefresh(
  key: string,
  currentAccessToken: string,
  refreshTokens: RefreshTokensFn,
  logger: Logger,
): Promise<RefreshedTokens> {
  const inFlight = REFRESH_IN_FLIGHT.get(key);
  if (inFlight) {
    logger.debug({ key }, '[TOKEN REFRESH] Joining in-flight refresh');
    return inFlight;
  }
  const promise = refreshTokens(currentAccessToken).finally(() => {
    REFRESH_IN_FLIGHT.delete(key);
  });
  REFRESH_IN_FLIGHT.set(key, promise);
  return promise;
}

const NOOP_LOGGER: Logger = {
  trace: () => undefined,
  error: () => undefined,
  warn: () => undefined,
  info: () => undefined,
  debug: () => undefined,
};

/**
 * Factory function to get api request
 * Requires a fetch compatible function to avoid relying any specific fetch implementation
 */
export function getApiRequestFactoryFn(fetch: FetchFn) {
  return (options: ApiRequestFactoryOptions = {}) => {
    const { logger = NOOP_LOGGER, refreshTokens, onConnectionError, enableLogging, getFreshTokens, onRefresh } = options;
    const apiRequest = async <Response = unknown>(requestOptions: ApiRequestOptions, attemptRefresh = true): Promise<Response> => {
      // eslint-disable-next-line prefer-const
      let { url, body, outputType, duplex } = requestOptions;
      const { method = 'GET', sessionInfo, headers, rawBody = false } = requestOptions;
      const { accessToken, instanceUrl } = sessionInfo;
      // Resolve + assert same-origin/HTTPS before attaching session credentials so a caller-controlled
      // `url` cannot redirect the org's bearer token to an attacker host (SSRF / credential exfiltration).
      url = resolveSameOriginRequestUrl(url, instanceUrl);
      outputType = outputType || 'json';
      if (isObject(body) && !rawBody) {
        body = JSON.stringify(body);
      }

      if (enableLogging) {
        logger.trace(`[API REQUEST]: ${method} ${url}`);
      }

      return fetch(url, {
        method,
        body,
        duplex,
        headers: {
          // default headers, can be overridden by caller
          [HTTP.HEADERS.CONTENT_TYPE]: 'application/json; charset=UTF-8',
          [HTTP.HEADERS.ACCEPT]: 'application/json; charset=UTF-8',
          // caller-provided overrides (auth/session/cookie/host stripped)
          ...sanitizeCallerHeaders(headers),
          // Server-bound credentials are set AFTER caller headers so they always win
          Authorization: `Bearer ${accessToken}`,
          [HTTP.HEADERS.X_SFDC_Session]: accessToken,
        },
      })
        .then(async (response) => {
          if (enableLogging) {
            logger.trace(`[API RESPONSE]: ${response.status}`);
            if (response.status !== 204) {
              response
                .clone()
                .text()
                .then((responseBody) => logger.trace({ responseBody }))
                // eslint-disable-next-line @typescript-eslint/no-empty-function
                .catch(() => {});
            }
          }
          if (response.ok) {
            if (response.status === 204) {
              return;
            }
            if (outputType === 'text') {
              return response.text();
            } else if (outputType === 'arrayBuffer') {
              return response.arrayBuffer();
            } else if (outputType === 'stream') {
              return response.body;
            } else if (outputType === 'xml') {
              return response.text().then((text) => parseXml(text));
            } else if (outputType === 'soap') {
              return response.text().then((text) => parseXml(text));
            } else if (outputType === 'response') {
              return response;
            } else if (outputType === 'void') {
              return;
            } else {
              return response.json();
            }
          }

          let responseText = await response.clone().text();

          if (
            attemptRefresh &&
            (response.status === 401 ||
              (response.status === 403 && responseText === BAS_ACCESS_TOKEN_403) ||
              (response.status === 500 && SOAP_API_AUTH_ERROR_REGEX.test(responseText))) &&
            sessionInfo.sfdcClientId &&
            sessionInfo.refreshToken
          ) {
            const logContext = {
              url,
              method,
              orgId: sessionInfo.organizationId,
              userId: sessionInfo.userId,
              status: response.status,
            };

            // Preferred path: single-flight + caller-owned refresh orchestrator. The closure handles
            // optimistic re-read, the Salesforce token exchange, and persistence. Losers within the
            // same process await the winner's promise rather than racing on Salesforce.
            if (refreshTokens) {
              try {
                const key = singleFlightKey(sessionInfo.userId, sessionInfo.organizationId);
                logger.debug(logContext, '[TOKEN REFRESH] Attempting refresh via injected closure');
                const refreshed = await runSingleFlightRefresh(key, accessToken, refreshTokens, logger);
                logger.debug(
                  { ...logContext, tokenRotated: refreshed.refreshToken !== sessionInfo.refreshToken },
                  '[TOKEN REFRESH] Refresh resolved',
                );
                // sessionInfo is a shared reference with ApiConnection — mutating it here updates the
                // connection's canonical state for all future requests without an extra callback hop.
                sessionInfo.accessToken = refreshed.accessToken;
                sessionInfo.refreshToken = refreshed.refreshToken;
                // replace token in body for SOAP requests that embed the bearer
                if (typeof requestOptions.body === 'string' && requestOptions.body.includes(accessToken)) {
                  requestOptions.body = requestOptions.body.replace(accessToken, refreshed.accessToken);
                }
                return apiRequest({ ...requestOptions, sessionInfo: { ...sessionInfo, accessToken: refreshed.accessToken } }, false);
              } catch (ex) {
                logger.warn(
                  { ...logContext, ...getErrorMessageAndStackObj(ex) },
                  '[TOKEN REFRESH] Refresh closure failed — marking connection invalid',
                );
                responseText = ERROR_MESSAGES.SFDC_EXPIRED_TOKEN;
                onConnectionError?.(ERROR_MESSAGES.SFDC_EXPIRED_TOKEN);
              }
            } else {
              // Legacy path retained for callers not yet migrated to `refreshTokens`. Still vulnerable
              // to the rotation race; the `getFreshTokens` fallback below is best-effort recovery.
              try {
                logger.debug(logContext, '[TOKEN REFRESH] Attempting token refresh (legacy path)');
                const { access_token: newAccessToken, refresh_token: newRefreshToken } = await exchangeRefreshToken(fetch, sessionInfo);
                logger.debug({ ...logContext, tokenRotated: !!newRefreshToken }, '[TOKEN REFRESH] Token refresh successful (legacy path)');
                await onRefresh?.(newAccessToken, newRefreshToken);
                if (typeof requestOptions.body === 'string' && requestOptions.body.includes(accessToken)) {
                  requestOptions.body = requestOptions.body.replace(accessToken, newAccessToken);
                }
                return apiRequest({ ...requestOptions, sessionInfo: { ...sessionInfo, accessToken: newAccessToken } }, false);
              } catch (ex) {
                logger.warn({ ...logContext, ...getErrorMessageAndStackObj(ex) }, '[TOKEN REFRESH] Unable to refresh accessToken');

                // Check if another worker already refreshed (race condition on token rotation).
                // If the DB has a different access token, a concurrent request won the race — retry with fresh tokens.
                // `return await` (not bare `return`) is deliberate: it keeps the recursive retry inside this
                // try/catch so a second failure still falls through to onConnectionError below.
                if (getFreshTokens) {
                  try {
                    const freshTokens = await getFreshTokens();
                    if (freshTokens && freshTokens.accessToken !== accessToken) {
                      logger.info(logContext, '[TOKEN REFRESH] Concurrent refresh detected — retrying with tokens from another worker');
                      // Sync the connection's canonical session state without re-persisting (DB already has these
                      // tokens — that's how we got them). Also mutates the shared sessionInfo reference so
                      // subsequent requests on this connection stop hitting the stale token path.
                      await onRefresh?.(freshTokens.accessToken, freshTokens.refreshToken, true);
                      if (typeof requestOptions.body === 'string' && requestOptions.body.includes(accessToken)) {
                        requestOptions.body = requestOptions.body.replace(accessToken, freshTokens.accessToken);
                      }
                      return await apiRequest({ ...requestOptions, sessionInfo: { ...sessionInfo, ...freshTokens } }, false);
                    }
                  } catch (freshEx) {
                    logger.warn(
                      { ...logContext, ...getErrorMessageAndStackObj(freshEx) },
                      '[TOKEN REFRESH] Failed to retrieve fresh tokens for race condition check',
                    );
                  }
                }

                responseText = ERROR_MESSAGES.SFDC_EXPIRED_TOKEN;
                onConnectionError?.(ERROR_MESSAGES.SFDC_EXPIRED_TOKEN);
              }
            }
          } else if (response.status === 420 && response.headers.get(HTTP.HEADERS.CONTENT_TYPE) === 'text/html') {
            responseText = 'An unexpected response was received from Salesforce. Please try again.';
          }
          // don't throw if caller wants the response back
          if (outputType === 'response') {
            return response as Response;
          }

          throw new ApiRequestError(handleSalesforceApiError(outputType || 'json', responseText), response);
        })
        .then((response) => {
          return response as Response;
        });
    };
    return apiRequest;
  };
}

function handleSalesforceApiError(outputType: ApiRequestOutputType, responseText?: string) {
  let output = responseText;
  if (outputType === 'json' && typeof responseText === 'string') {
    try {
      const tempResult = JSON.parse(responseText) as { message: string } | { message: string }[];
      output = (Array.isArray(tempResult) ? tempResult[0] : tempResult)?.message;
    } catch {
      output = responseText;
    }
    output = output || responseText;
  } else if (outputType === 'soap' && typeof responseText === 'string') {
    try {
      const tempResult = parseXml(responseText) as unknown as SoapErrorResponse;
      output = tempResult.Envelope.Body.Fault.faultstring;
    } catch {
      output = responseText;
    }
    output = output || responseText;
  } else if (
    outputType === 'xml' &&
    typeof responseText === 'string' &&
    responseText.includes(`xmlns="http://www.force.com/2009/06/asyncapi/dataload"`)
  ) {
    try {
      const tempResult = parseXml(responseText) as unknown as BulkXmlErrorResponse;
      output = tempResult.error.exceptionMessage;
    } catch {
      output = responseText;
    }
    output = output || responseText;
  }
  return output;
}

/**
 * Bounds the Salesforce token exchange so a stalled `/services/oauth2/token` endpoint can't
 * pin a DB connection (held by `refreshTokensWithLock`'s transaction) indefinitely. SF's auth
 * endpoint is normally <500ms; 15s is comfortably above any healthy response time and well
 * below the surrounding transaction timeout so the abort fires first and we get a clean error.
 */
export const REFRESH_TOKEN_EXCHANGE_TIMEOUT_MS = 15_000;

/**
 * Exchanges a refresh token for a new access token (and possibly rotated refresh token).
 *
 * Exported so caller-supplied `RefreshTokensFn` closures (web middleware, desktop main process)
 * can invoke it from inside their own coordination (advisory lock, in-memory check, etc).
 *
 * The fetch is bounded by an `AbortSignal.timeout` so the call cannot hang forever — important
 * because the web path holds a Postgres advisory-lock transaction across this call.
 */
export function exchangeRefreshToken(
  fetch: FetchFn,
  sessionInfo: ApiRequestOptions['sessionInfo'],
  { timeoutMs = REFRESH_TOKEN_EXCHANGE_TIMEOUT_MS }: { timeoutMs?: number } = {},
): Promise<{ access_token: string; refresh_token?: string }> {
  const searchParams = new URLSearchParams({
    grant_type: 'refresh_token',
  });
  if (sessionInfo.sfdcClientId) {
    searchParams.set('client_id', sessionInfo.sfdcClientId);
  }
  if (sessionInfo.sfdcClientSecret) {
    searchParams.set('client_secret', sessionInfo.sfdcClientSecret);
  }
  if (sessionInfo.refreshToken) {
    searchParams.set('refresh_token', sessionInfo.refreshToken);
  }
  return fetch(`${sessionInfo.instanceUrl}/services/oauth2/token`, {
    method: 'POST',
    body: searchParams.toString(),
    headers: {
      [HTTP.HEADERS.CONTENT_TYPE]: HTTP.CONTENT_TYPE.FORM_URL,
      [HTTP.HEADERS.ACCEPT]: HTTP.CONTENT_TYPE.JSON,
    },
    signal: AbortSignal.timeout(timeoutMs),
  })
    .then((response) => {
      if (response.ok) {
        return response;
      }
      throw new Error(ERROR_MESSAGES.SFDC_EXPIRED_TOKEN);
    })
    .then((response) => response.json())
    .then((response) => {
      return response as { access_token: string; refresh_token?: string };
    });
}
