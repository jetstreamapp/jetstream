import { HTTP } from '@jetstream/shared/constants';
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AxiosAdapterConfig, handleRequest } from '../client-data-data-helper';
import { ApiRequestError, isAuthenticationFailure } from '../client-data-errors';

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
