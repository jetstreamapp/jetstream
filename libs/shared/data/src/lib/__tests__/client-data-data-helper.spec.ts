import { CSRF_TOKEN_INVALID_ERROR_TYPE } from '@jetstream/auth/types';
import { HTTP } from '@jetstream/shared/constants';
import { SalesforceOrgUi } from '@jetstream/types';
import axios, { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getCacheItemHttp, saveCacheItemHttp } from '../client-data-cache';
import { AxiosAdapterConfig, clearSessionCsrfToken, getSessionCsrfToken, handleRequest } from '../client-data-data-helper';
import { ApiRequestError, isAuthenticationFailure } from '../client-data-errors';
import { onOrgActivity } from '../middleware';

vi.mock('../client-data-cache', () => ({
  getCacheItemHttp: vi.fn(async () => null),
  saveCacheItemHttp: vi.fn(async () => undefined),
}));

const mockedAdapter = vi.fn<(config: InternalAxiosRequestConfig) => Promise<AxiosResponse>>();

function successResponse(config: InternalAxiosRequestConfig, data: unknown): AxiosResponse {
  return { config, data: { data }, status: 200, statusText: 'OK', headers: {}, request: {} };
}

function networkError(): AxiosError {
  return new AxiosError('Network Error', AxiosError.ERR_NETWORK, {} as InternalAxiosRequestConfig, {});
}

function errorResponse(status: number, message: string): AxiosError {
  const config = { method: 'get', url: '/api/me' } as InternalAxiosRequestConfig;
  return new AxiosError(`Request failed with status code ${status}`, AxiosError.ERR_BAD_RESPONSE, config, {}, {
    config,
    data: { error: true, message },
    status,
    statusText: '',
    headers: {},
  } as AxiosResponse);
}

/** Attach the rejection handler up front so advancing timers cannot surface an unhandled rejection. */
function captureResult<T>(promise: Promise<T>): Promise<T | Error> {
  return promise.catch((ex: Error) => ex);
}

describe('handleRequest', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockedAdapter.mockReset();
    AxiosAdapterConfig.adapter = mockedAdapter;
  });

  afterEach(() => {
    vi.useRealTimers();
    AxiosAdapterConfig.adapter = undefined;
  });

  // The retried request is issued by a nested axios instance that does not itself carry the retry
  // interceptor, so the chain stops after one retry regardless of `RETRY_CONFIG.retry`.
  it('retries GET /api/me when the request never reaches the server, then reports the failure', async () => {
    mockedAdapter.mockRejectedValue(networkError());

    const result = captureResult(handleRequest({ method: 'GET', url: '/api/me' }));
    await vi.runAllTimersAsync();
    const error = await result;

    expect(mockedAdapter).toHaveBeenCalledTimes(2);
    // The retry must go back through the configured adapter, which is the only transport the
    // desktop, extension and canvas apps have
    expect(mockedAdapter.mock.calls[1][0].headers[HTTP.HEADERS.X_RETRY]).toBe('1');
    // A failure with no response must stay distinguishable from one the server rejected
    expect(error).toBeInstanceOf(ApiRequestError);
    expect((error as ApiRequestError).status).toBeNull();
    expect(isAuthenticationFailure(error)).toBe(false);
  });

  it('retries GET /api/me on a server error and returns the retried response', async () => {
    mockedAdapter
      .mockRejectedValueOnce(errorResponse(503, 'Service Unavailable'))
      .mockImplementationOnce((config) => Promise.resolve(successResponse(config, { id: 'user-1' })));

    const result = captureResult(handleRequest({ method: 'GET', url: '/api/me' }));
    await vi.runAllTimersAsync();

    expect(await result).toEqual({ data: { id: 'user-1' } });
    expect(mockedAdapter).toHaveBeenCalledTimes(2);
  });

  it('does not retry GET /api/me when the server says the user is not authenticated', async () => {
    mockedAdapter.mockRejectedValue(errorResponse(401, 'Unauthorized'));

    const result = captureResult(handleRequest({ method: 'GET', url: '/api/me' }));
    await vi.runAllTimersAsync();
    const error = await result;

    expect(mockedAdapter).toHaveBeenCalledTimes(1);
    expect((error as ApiRequestError).status).toBe(401);
    expect(isAuthenticationFailure(error)).toBe(true);
  });

  it('leaves endpoints outside the retry allowlist alone', async () => {
    mockedAdapter.mockRejectedValue(networkError());

    const result = captureResult(handleRequest({ method: 'GET', url: '/api/orgs' }));
    await vi.runAllTimersAsync();
    const error = await result;

    expect(mockedAdapter).toHaveBeenCalledTimes(1);
    expect(isAuthenticationFailure(error)).toBe(false);
  });
});

describe('org activity reporting', () => {
  const org = { uniqueId: 'org-1' } as SalesforceOrgUi;
  const targetOrg = { uniqueId: 'org-2' } as SalesforceOrgUi;
  const activityHeader = HTTP.HEADERS.X_SFDC_ORG_ACTIVITY;

  let activeOrgs: string[];
  let unsubscribe: () => void;

  beforeEach(() => {
    mockedAdapter.mockReset();
    AxiosAdapterConfig.adapter = mockedAdapter;
    activeOrgs = [];
    unsubscribe = onOrgActivity(({ uniqueId }) => activeOrgs.push(uniqueId));
  });

  afterEach(() => {
    unsubscribe();
    AxiosAdapterConfig.adapter = undefined;
  });

  function respondWith(headers: Record<string, string>) {
    mockedAdapter.mockImplementation(async (config) => ({
      config,
      data: { data: {} },
      status: 200,
      statusText: 'OK',
      headers,
      request: {},
    }));
  }

  it('reports the orgs the server says it recorded activity for', async () => {
    respondWith({ [activityHeader]: 'org-1,org-2' });

    await handleRequest({ method: 'GET', url: '/api/query' }, { org, targetOrg });

    expect(activeOrgs).toEqual(['org-1', 'org-2']);
  });

  it('ignores orgs the server did not report, even when the request carried them', async () => {
    respondWith({ [activityHeader]: 'org-1' });

    await handleRequest({ method: 'GET', url: '/api/query' }, { org, targetOrg });

    expect(activeOrgs).toEqual(['org-1']);
  });

  it('reports nothing for a response the server did not produce', async () => {
    respondWith({});

    await handleRequest({ method: 'GET', url: '/api/query' }, { org });

    expect(activeOrgs).toEqual([]);
  });

  /**
   * The deadline is pushed back in middleware that runs before the route handler, so a handler that
   * fails afterwards has still reset the clock - missing this was what left a just-used org showing
   * an expiration warning after any failed request against it.
   */
  it('reports activity from a failed response', async () => {
    const config = { method: 'get', url: '/api/query' } as InternalAxiosRequestConfig;
    mockedAdapter.mockRejectedValue(
      new AxiosError('Request failed with status code 400', AxiosError.ERR_BAD_RESPONSE, config, {}, {
        config,
        data: { error: true, message: 'INVALID_FIELD' },
        status: 400,
        statusText: '',
        headers: { [activityHeader]: 'org-1' },
      } as AxiosResponse),
    );

    await captureResult(handleRequest({ method: 'GET', url: '/api/query' }, { org }));

    expect(activeOrgs).toEqual(['org-1']);
  });

  /**
   * Retryable failures are swallowed by the retry interceptor, which replaces the response - so the
   * activity the first attempt reported has to be read before it is thrown away.
   */
  it('reports activity from a response that is discarded in favour of a retry', async () => {
    vi.useFakeTimers();
    const config = { method: 'get', url: '/api/query-more' } as InternalAxiosRequestConfig;
    mockedAdapter
      .mockRejectedValueOnce(
        new AxiosError('Request failed with status code 503', AxiosError.ERR_BAD_RESPONSE, config, {}, {
          config,
          data: { error: true, message: 'Service Unavailable' },
          status: 503,
          statusText: '',
          headers: { [activityHeader]: 'org-1' },
        } as AxiosResponse),
      )
      .mockRejectedValueOnce(new AxiosError('Network Error', AxiosError.ERR_NETWORK, config, {}));

    const result = captureResult(handleRequest({ method: 'GET', url: '/api/query-more' }, { org }));
    await vi.runAllTimersAsync();
    await result;
    vi.useRealTimers();

    expect(activeOrgs).toEqual(['org-1']);
  });

  /** A deferred response commits its status before the Salesforce call, so errors arrive in the body */
  it('reports activity from a deferred response carrying an error', async () => {
    mockedAdapter.mockImplementation(async (config) => ({
      config,
      data: { error: true, message: 'INVALID_FIELD' },
      status: 200,
      statusText: 'OK',
      headers: { [activityHeader]: 'org-1', [HTTP.HEADERS.X_DEFERRED_RESPONSE]: '1' },
      request: {},
    }));

    await captureResult(handleRequest({ method: 'GET', url: '/api/query' }, { org }));

    expect(activeOrgs).toEqual(['org-1']);
  });
});

describe('CSRF token', () => {
  const CSRF_TOKEN_URL = '/api/csrf-token';
  const defaultAdapter = axios.defaults.adapter;
  /** What the token endpoint returns, standing in for the HttpOnly cookie the server holds */
  let serverToken: string;

  function errorResponseWithBody(status: number, data: Record<string, unknown>): AxiosError {
    const config = { method: 'post', url: '/api/query' } as InternalAxiosRequestConfig;
    return new AxiosError(`Request failed with status code ${status}`, AxiosError.ERR_BAD_REQUEST, config, {}, {
      config,
      data,
      status,
      statusText: '',
      headers: {},
    } as AxiosResponse);
  }

  /** A rejection whose config carries the token that was sent, as axios reports it */
  function csrfRejection(config: InternalAxiosRequestConfig): AxiosError {
    const error = errorResponseWithBody(403, { error: true, message: 'Invalid CSRF token', errorType: CSRF_TOKEN_INVALID_ERROR_TYPE });
    error.config = config;
    return error;
  }

  /** Serves the token endpoint from `serverToken` and every other request from `handler` */
  function serve(handler: (config: InternalAxiosRequestConfig) => Promise<AxiosResponse>) {
    mockedAdapter.mockImplementation(async (config) =>
      config.url === CSRF_TOKEN_URL ? successResponse(config, { csrfToken: serverToken }) : handler(config),
    );
  }

  const apiRequests = () => mockedAdapter.mock.calls.map(([config]) => config).filter(({ url }) => url !== CSRF_TOKEN_URL);
  const sentCsrfTokens = () => apiRequests().map(({ headers }) => headers[HTTP.HEADERS.X_CSRF_TOKEN]);
  const tokenFetchCount = () => mockedAdapter.mock.calls.filter(([{ url }]) => url === CSRF_TOKEN_URL).length;

  beforeEach(() => {
    mockedAdapter.mockReset();
    vi.mocked(getCacheItemHttp).mockReset();
    vi.mocked(saveCacheItemHttp).mockReset();
    clearSessionCsrfToken();
    serverToken = 'token-for-current-session';
    // The web app sends requests through axios' own adapter; a platform adapter means there is no session cookie
    AxiosAdapterConfig.adapter = undefined;
    axios.defaults.adapter = mockedAdapter;
  });

  afterEach(() => {
    axios.defaults.adapter = defaultAdapter;
    AxiosAdapterConfig.adapter = undefined;
  });

  it('fetches the token once for concurrent mutations and sends it on each', async () => {
    serve(async (config) => successResponse(config, {}));

    await Promise.all([
      handleRequest({ method: 'POST', url: '/api/query', data: {} }),
      handleRequest({ method: 'DELETE', url: '/api/orgs/org-1' }),
    ]);
    await handleRequest({ method: 'PUT', url: '/api/orgs/org-1/move', data: {} });

    expect(tokenFetchCount()).toBe(1);
    expect(sentCsrfTokens()).toEqual(['token-for-current-session', 'token-for-current-session', 'token-for-current-session']);
  });

  it('does not fetch or send a token for read requests', async () => {
    serve(async (config) => successResponse(config, {}));

    await handleRequest({ method: 'GET', url: '/api/me' });

    expect(tokenFetchCount()).toBe(0);
    expect(sentCsrfTokens()).toEqual([undefined]);
  });

  it('sends no token when requests go through a platform adapter', async () => {
    const platformAdapter = vi.fn(async (config: InternalAxiosRequestConfig) => successResponse(config, {}));
    AxiosAdapterConfig.adapter = platformAdapter;

    await handleRequest({ method: 'POST', url: '/api/query', data: {} });

    expect(tokenFetchCount()).toBe(0);
    expect(platformAdapter.mock.calls[0][0].headers[HTTP.HEADERS.X_CSRF_TOKEN]).toBeUndefined();
    expect(await getSessionCsrfToken()).toBeNull();
  });

  // e.g. the session changed after the token was cached; the server holds the replacement
  it('resends the request once with the token the server holds after a rejection', async () => {
    serverToken = 'token-for-previous-session';
    serve(async (config) => {
      if (config.headers[HTTP.HEADERS.X_CSRF_TOKEN] === 'token-for-previous-session') {
        serverToken = 'token-for-current-session';
        throw csrfRejection(config);
      }
      return successResponse(config, { records: [] });
    });

    const result = await handleRequest({ method: 'POST', url: '/api/query', data: { query: 'SELECT Id FROM Account' } });

    expect(result).toEqual({ data: { records: [] } });
    expect(sentCsrfTokens()).toEqual(['token-for-previous-session', 'token-for-current-session']);
    expect(tokenFetchCount()).toBe(2);
  });

  it('keeps a replacement token that another rejected request already fetched', async () => {
    serverToken = 'token-for-previous-session';
    serve(async (config) => {
      if (config.headers[HTTP.HEADERS.X_CSRF_TOKEN] === 'token-for-previous-session') {
        serverToken = 'token-for-current-session';
        throw csrfRejection(config);
      }
      return successResponse(config, {});
    });

    await Promise.all([
      handleRequest({ method: 'POST', url: '/api/query', data: {} }),
      handleRequest({ method: 'POST', url: '/api/query', data: {} }),
    ]);
    await handleRequest({ method: 'POST', url: '/api/query', data: {} });

    expect(sentCsrfTokens().slice(2)).toEqual(['token-for-current-session', 'token-for-current-session', 'token-for-current-session']);
    expect(tokenFetchCount()).toBe(2);
  });

  it('reports a second CSRF rejection instead of retrying again', async () => {
    serve(async (config) => {
      throw csrfRejection(config);
    });

    const error = await captureResult(handleRequest({ method: 'POST', url: '/api/query', data: {} }));

    expect(apiRequests()).toHaveLength(2);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect((error as ApiRequestError).status).toBe(403);
    expect((error as ApiRequestError).message).toBe('Invalid CSRF token');
  });

  it('processes the recovered response once', async () => {
    const org = { uniqueId: 'org-1' } as SalesforceOrgUi;
    const activeOrgs: string[] = [];
    const unsubscribe = onOrgActivity(({ uniqueId }) => activeOrgs.push(uniqueId));
    serverToken = 'token-for-previous-session';
    serve(async (config) => {
      if (config.headers[HTTP.HEADERS.X_CSRF_TOKEN] === 'token-for-previous-session') {
        serverToken = 'token-for-current-session';
        throw csrfRejection(config);
      }
      return { ...successResponse(config, { records: [] }), headers: { [HTTP.HEADERS.X_SFDC_ORG_ACTIVITY]: 'org-1' } };
    });

    try {
      await handleRequest({ method: 'POST', url: '/api/query', data: {} }, { org, useCache: true });
    } finally {
      unsubscribe();
    }

    expect(activeOrgs).toEqual(['org-1']);
    expect(saveCacheItemHttp).toHaveBeenCalledTimes(1);
  });

  it('does not resend a 403 for any other reason', async () => {
    serve(async () => {
      throw errorResponseWithBody(403, { error: true, message: 'Forbidden' });
    });

    const error = await captureResult(handleRequest({ method: 'POST', url: '/api/query', data: {} }));

    expect(apiRequests()).toHaveLength(1);
    expect((error as ApiRequestError).status).toBe(403);
  });
});
