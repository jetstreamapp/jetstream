/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from '@jetstream/shared/client-logger';
import { HTTP } from '@jetstream/shared/constants';
import { delay } from '@jetstream/shared/utils';
import {
  ApiResponse,
  ListMetadataResult,
  ListMetadataResultRaw,
  RetrieveResult,
  RetrieveResultRaw,
  SalesforceOrgUi,
} from '@jetstream/types';
import axios, {
  AxiosError,
  AxiosRequestConfig,
  AxiosResponse,
  AxiosResponseHeaders,
  InternalAxiosRequestConfig,
  RawAxiosResponseHeaders,
} from 'axios';
import { parseISO } from 'date-fns/parseISO';
import isEmpty from 'lodash/isEmpty';
import isObject from 'lodash/isObject';
import isString from 'lodash/isString';
import { v4 as uuid } from 'uuid';
import { getCacheItemHttp, saveCacheItemHttp } from './client-data-cache';
import { SOBJECT_DESCRIBE_CACHED_RESPONSES } from './client-data-data-cached-responses';
import { errorMiddleware } from './middleware';

interface RequestOptions {
  org?: SalesforceOrgUi;
  targetOrg?: SalesforceOrgUi;
  mockHeaderKey?: string;
  useCache?: boolean;
  skipRequestCache?: boolean;
  skipCacheIfOlderThan?: number;
  useQueryParamsInCacheKey?: boolean;
  useBodyInCacheKey?: boolean;
  retryCount?: number;
}

const RETRY_CONFIG = {
  /** Number of times to retry */
  retry: 2,
  /** Exponential Backoff */
  retryDelay: (retryCount: number) => {
    return retryCount * 1_000;
  },
  endpoints: [
    /^\/api\/metadata\/deploy\/([a-zA-Z0-9]+)$/,
    /^\/api\/metadata\/retrieve\/check-results$/,
    /^\/api\/bulk\/([a-zA-Z0-9]+)$/,
    /^\/api\/bulk\/([a-zA-Z0-9]+)\/([a-zA-Z0-9]+)$/,
  ],
  methods: new Set(['GET']),
  statusCodes: new Set([429, 500, 502, 503, 504]),
} as const;

function getHeader(headers: RawAxiosResponseHeaders | AxiosResponseHeaders, header: string) {
  if (!headers || !header) {
    return null;
  }
  const value = headers[header] || headers[header.toLowerCase()];
  if (!value && typeof headers.get === 'function') {
    return headers.get(header) || headers.get(header.toLowerCase());
  }
  return value;
}

const baseConfig: Partial<InternalAxiosRequestConfig> = {};

/** Use for API calls going to external locations */
export async function handleExternalRequest<T = any>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
  const axiosInstance = axios.create({ ...baseConfig, ...config });
  axiosInstance.interceptors.request.use(requestInterceptor({}));
  axiosInstance.interceptors.response.use(
    (response) => {
      logger.info(`[HTTP][RES][${response.config.method?.toUpperCase()}][${response.status}]`, response.config.url, {
        requestId: response.headers['x-request-id'],
        response: response.data,
      });
      return response;
    },
    (error: AxiosError) => {
      logger.error('[HTTP][RESPONSE][ERROR]', {
        requestId: response.headers['x-request-id'],
        errorName: error.name,
        errorMessage: error.message,
      });
      let message = 'An unknown error has occurred';
      if (error.isAxiosError && error.response) {
        message = error.message || 'An unknown error has occurred';
        logger.error(`[HTTP][RES][${response.config.method?.toUpperCase()}][${response.status}]`, response.config.url, {
          response: response.data,
        });
      }
      throw new Error(message);
    }
  );
  const response = await axiosInstance.request<T>(config);
  return response;
}

export async function handleRequest<T = any>(config: AxiosRequestConfig, options: RequestOptions = {}): Promise<ApiResponse<T>> {
  if (options.mockHeaderKey && isString(options.mockHeaderKey)) {
    config.headers = config.headers || {};
    config.headers[HTTP.HEADERS.X_MOCK_KEY] = options.mockHeaderKey;
  }
  options.retryCount = options.retryCount || 0;
  const axiosInstance = axios.create({ ...baseConfig, ...config });
  axiosInstance.interceptors.request.use(requestInterceptor(options));
  axiosInstance.interceptors.response.use(null, retryInterceptor(config, options));
  axiosInstance.interceptors.response.use(responseInterceptor(options), responseErrorInterceptor(options));
  const response = await axiosInstance.request<ApiResponse<T>>(config);
  return response.data;
}

/**
 * Handle requests
 * Add authentication and org info
 * Optionally returned cached response instead of actual response
 */
function requestInterceptor<T>(options: RequestOptions) {
  return async (config: InternalAxiosRequestConfig) => {
    logger.info(`[HTTP][REQ][${config.method?.toUpperCase()}]`, config.url, { request: config });
    const { org, targetOrg, useCache, skipRequestCache, skipCacheIfOlderThan, useQueryParamsInCacheKey, useBodyInCacheKey } = options;
    // add request headers
    config.headers = config.headers || ({} as any);
    config.headers[HTTP.HEADERS.X_CLIENT_REQUEST_ID] = config.headers[HTTP.HEADERS.X_CLIENT_REQUEST_ID] || uuid();

    if (!config.headers[HTTP.HEADERS.ACCEPT]) {
      config.headers[HTTP.HEADERS.ACCEPT] = HTTP.CONTENT_TYPE.JSON;
    }

    if (org) {
      config.headers[HTTP.HEADERS.X_SFDC_ID] = org.uniqueId || '';
    }

    if (targetOrg) {
      config.headers[HTTP.HEADERS.X_SFDC_ID_TARGET] = targetOrg.uniqueId || '';
    }

    // IF mock response header exists and mock response exists, return data instead of making actual request
    if (config.headers[HTTP.HEADERS.X_MOCK_KEY] && SOBJECT_DESCRIBE_CACHED_RESPONSES[config.headers[HTTP.HEADERS.X_MOCK_KEY] as string]) {
      config.adapter = (config: InternalAxiosRequestConfig) => {
        return new Promise((resolve) => {
          resolve({
            data: SOBJECT_DESCRIBE_CACHED_RESPONSES[config.headers?.[HTTP.HEADERS.X_MOCK_KEY] as string],
            status: 200,
            statusText: 'OK',
            headers: {},
            config,
          });
        });
      };
    } else if (useCache && org && !skipRequestCache) {
      // return cached response if available
      const cachedResults = await getCacheItemHttp<T>(config, org, useQueryParamsInCacheKey, useBodyInCacheKey);
      if (cachedResults) {
        // if skipCacheIfOlderThan is provided, then see if cache is older than provided date and skip cache if so
        if (!skipCacheIfOlderThan || (Number.isFinite(skipCacheIfOlderThan) && cachedResults.age >= skipCacheIfOlderThan)) {
          config.adapter = async (config: InternalAxiosRequestConfig) => {
            return new Promise((resolve) => {
              resolve({
                config,
                data: {
                  data: cachedResults.data,
                  cache: {
                    age: cachedResults.age,
                    exp: cachedResults.exp,
                    key: cachedResults.key,
                  },
                },
                headers: {
                  [HTTP.HEADERS.X_CACHE_RESPONSE]: '1',
                  [HTTP.HEADERS.X_CACHE_KEY]: cachedResults.key,
                  [HTTP.HEADERS.X_CACHE_AGE]: `${cachedResults.age}`,
                  [HTTP.HEADERS.X_CACHE_EXP]: `${cachedResults.exp}`,
                },
                status: 200,
                statusText: 'OK (CACHED)',
                request: {},
              });
            });
          };
        }
      }
    }

    return config;
  };
}

/**
 * Retry error responses if needed
 * Caller must set options.retry to true to enable retry
 */
function retryInterceptor(config: AxiosRequestConfig, options: RequestOptions = {}) {
  return async (error: AxiosError) => {
    let { retryCount } = options;
    retryCount = retryCount || 0;
    const { endpoints, retry, retryDelay, methods, statusCodes } = RETRY_CONFIG;
    if (
      retryCount <= retry &&
      methods.has(config.method || '') &&
      statusCodes.has(error.response?.status || -1) &&
      endpoints.some((endpoint) => endpoint.test(config.url || ''))
    ) {
      retryCount++;
      await delay(retryDelay(retryCount));
      logger.warn(`[HTTP][RETRYING REQUEST]`, config.url, { retryCount, error: error.message });

      options = { ...options, retryCount: retryCount };
      config.headers = { ...config.headers, [HTTP.HEADERS.X_RETRY]: String(retryCount) };
      const axiosInstance = axios.create({ ...config });
      axiosInstance.interceptors.request.use(requestInterceptor(options));
      axiosInstance.interceptors.response.use(responseInterceptor(options), responseErrorInterceptor(options));
      return await axiosInstance.request(config);
    }
    return Promise.reject(error);
  };
}

/**
 * Handle successful responses
 */
function responseInterceptor<T>(options: RequestOptions): (response: AxiosResponse) => Promise<AxiosResponse<T>> {
  return async (response: AxiosResponse) => {
    const { org, useCache, useQueryParamsInCacheKey, useBodyInCacheKey } = options;
    const cachedResponse = getHeader(response.headers, HTTP.HEADERS.X_CACHE_RESPONSE) === '1';
    if (cachedResponse) {
      logger.info(`[HTTP][RES][${response.config.method?.toUpperCase()}][CACHE]`, response.config.url, { response: response.data });
    } else {
      logger.info(`[HTTP][RES][${response.config.method?.toUpperCase()}][${response.status}]`, response.config.url, {
        clientRequestId: response.headers['x-client-request-id'],
        requestId: response.headers['x-request-id'],
        response: response.data,
      });
    }

    const body: ApiResponse<T> = response.data;
    const responseData = body ? body.data : undefined;

    // if response should be cached and response came from server, save
    if (useCache && responseData && !cachedResponse) {
      // promise results are ignored from critical path
      const cacheItem = await saveCacheItemHttp<T>(responseData, response.config, org, useQueryParamsInCacheKey, useBodyInCacheKey);
      if (cacheItem) {
        body.cache = {
          age: new Date().getTime(),
          exp: cacheItem.exp,
          key: cacheItem.key,
        };
      }
    }
    // TODO: we should wrap this in a data structure that includes cache info so we can display in UI where appropriate
    return response;
  };
}

/**
 * Handle error responses
 */
function responseErrorInterceptor<T>(options: {
  org?: SalesforceOrgUi;
  useCache?: boolean;
  useQueryParamsInCacheKey?: boolean;
  useBodyInCacheKey?: boolean;
}) {
  return (error: AxiosError) => {
    const { org } = options;
    logger.error('[HTTP][RESPONSE][ERROR]', error.name, error.message);
    let message = 'An unknown error has occurred';
    if (error.isAxiosError && error.response) {
      const response = error.response as AxiosResponse<{ error: boolean; message: string }>;
      logger.error(`[HTTP][RES][${response.config.method?.toUpperCase()}][${response.status}]`, response.config.url, {
        clientRequestId: response.headers['x-client-request-id'],
        requestId: response.headers['x-request-id'],
        response: response.data,
      });
      // Run middleware for error responses
      errorMiddleware.forEach((middleware) => middleware(response, org));
      const responseBody: { error: boolean; message: string } = response.data || { error: true, message: 'An unknown error has occurred' };
      message = responseBody?.message || 'An unknown error has occurred';
      // take user to login page
      if (getHeader(response.headers, HTTP.HEADERS.X_LOGOUT) === '1') {
        // LOG USER OUT
        const logoutUrl = getHeader(response.headers, HTTP.HEADERS.X_LOGOUT_URL) || '/oauth/login';
        // stupid unit tests - location.href is readonly TS compilation failure
        // eslint-disable-next-line no-restricted-globals
        (location as any).href = logoutUrl;
      }
    }
    throw new Error(message);
  };
}

export function transformListMetadataResponse(items: ListMetadataResultRaw[]): ListMetadataResult[] {
  // metadata responses have variable return types because XML parsing is sketchy
  if (!Array.isArray(items)) {
    items = isEmpty(items) ? [] : [items];
  }
  return items.map((item) => ({
    ...item,
    createdDate: parseISO(item.createdDate),
    lastModifiedDate: parseISO(item.lastModifiedDate),
    // Some items, such as Settings do not include the property manageableState
    manageableState: item.manageableState || 'unmanaged',
  }));
}

export function transformRetrieveRequestResponse(item: RetrieveResultRaw): RetrieveResult {
  return {
    ...item,
    done: item.done === 'true',
    success: item.success === 'true',
    zipFile: isObject(item.zipFile) ? null : item.zipFile,
  };
}
