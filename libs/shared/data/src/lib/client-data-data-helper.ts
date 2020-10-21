/* eslint-disable @typescript-eslint/no-explicit-any */
import { ApiResponse, OrgCacheItem, CacheItemWithData, SalesforceOrgUi } from '@jetstream/types';
import { HTTP, INDEXED_DB } from '@jetstream/shared/constants';
import { logger } from '@jetstream/shared/client-logger';
import { errorMiddleware } from './middleware';
import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import localforage from 'localforage';
import { REGEX } from '@jetstream/shared/utils';
import { isString } from 'lodash';

// 3 days
const CACHE_TTL = 1000 * 60 * 60 * 24 * 3;

export async function handleRequest<T = any>(
  config: AxiosRequestConfig,
  options: {
    org?: SalesforceOrgUi;
    useCache?: boolean;
    useQueryParamsInCacheKey?: boolean;
    useBodyInCacheKey?: boolean;
  } = {}
): Promise<ApiResponse<T>> {
  const axiosInstance = axios.create(config);
  axiosInstance.interceptors.request.use(requestInterceptor(options));
  axiosInstance.interceptors.response.use(responseInterceptor(options), responseErrorInterceptor(options));
  const response = await axiosInstance.request<ApiResponse<T>>(config);
  return response.data;
}

/**
 * Handle requests
 * Add authentication and org info
 * Optionally returned cached response instead of actual response
 */
function requestInterceptor<T>(options: {
  org?: SalesforceOrgUi;
  useCache?: boolean;
  useQueryParamsInCacheKey?: boolean;
  useBodyInCacheKey?: boolean;
}) {
  return async (config: AxiosRequestConfig) => {
    const { org, useCache, useQueryParamsInCacheKey, useBodyInCacheKey } = options;
    // add request headers
    config.headers = config.headers || {};
    if (!config.headers[HTTP.HEADERS.ACCEPT]) {
      config.headers[HTTP.HEADERS.ACCEPT] = HTTP.CONTENT_TYPE.JSON;
    }

    if (org) {
      config.headers[HTTP.HEADERS.X_SFDC_ID] = org.uniqueId || '';
    }

    // return cached response if available
    if (useCache && org) {
      const cachedResults = await getCacheItem<T>(config, org, useQueryParamsInCacheKey, useBodyInCacheKey);
      if (cachedResults) {
        logger.info(`[HTTP][REQ][${config.method}][CACHE]`, config.url, { request: config });
        config.adapter = async (config: AxiosRequestConfig) => {
          return {
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
              [HTTP.HEADERS.X_CACHE_AGE]: cachedResults.age,
              [HTTP.HEADERS.X_CACHE_EXP]: cachedResults.exp,
            },
            status: 200,
            statusText: 'OK (CACHED)',
            request: {},
          };
        };
      } else {
        logger.info(`[HTTP][REQ][${config.method}]`, config.url, { request: config });
      }
    } else {
      logger.info(`[HTTP][REQ][${config.method}]`, config.url, { request: config });
    }

    return config;
  };
}

/**
 * Handle successful responses
 */
function responseInterceptor<T>(options: {
  org?: SalesforceOrgUi;
  useCache?: boolean;
  useQueryParamsInCacheKey?: boolean;
  useBodyInCacheKey?: boolean;
}): (response: AxiosResponse) => Promise<AxiosResponse<T>> {
  return async (response: AxiosResponse) => {
    const { org, useCache, useQueryParamsInCacheKey, useBodyInCacheKey } = options;
    logger.info(`[HTTP][RES][${response.config.method}][${response.status}]`, response.config.url, { response: response.data });

    const body: ApiResponse<T> = response.data;
    const responseData = body ? body.data : undefined;

    // if response should be cached and response came from server, save
    if (useCache && responseData && !response.headers[HTTP.HEADERS.X_CACHE_RESPONSE]) {
      // promise results are ignored from critical path
      const cacheItem = await saveCacheItem<T>(responseData, response.config, org, useQueryParamsInCacheKey, useBodyInCacheKey);
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
    logger.info('[HTTP][RESPONSE][ERROR]', error.name, error.message);
    let message = 'An unknown error has occurred';
    if (error.isAxiosError && error.response) {
      const response = error.response as AxiosResponse<{ error: boolean; message: string }>;
      // Run middleware for error responses
      errorMiddleware.forEach((middleware) => middleware(response, org));
      const responseBody: { error: boolean; message: string } = response.data;
      message = responseBody.message || 'An unknown error has occurred';
      // take user to login page
      if (response.headers[HTTP.HEADERS.X_LOGOUT] === '1') {
        // LOG USER OUT
        const logoutUrl = response.headers[HTTP.HEADERS.X_LOGOUT_URL] || '/oauth/login';
        // eslint-disable-next-line no-restricted-globals
        location.href = logoutUrl;
      }
    }
    throw new Error(message);
  };
}

/**
 *
 * CACHE HELPERS
 * TODO: MOVE TO SOME OTHER FILE?
 *
 */

export async function clearCacheForOrg(org: SalesforceOrgUi) {
  try {
    const key = `${INDEXED_DB.KEYS.httpCache}:${org.uniqueId}`;
    await localforage.removeItem(key);
    logger.log('[HTTP][CACHE][REMOVED]', key);
  } catch (ex) {
    logger.log('[HTTP][CACHE][ERROR]', ex);
  }
}

/**
 * GET ITEM FROM CACHE OR RETURN NULL
 * @param data
 * @param config
 * @param org
 * @param useQueryParamsInCacheKey
 */
async function getCacheItem<T>(
  config: AxiosRequestConfig,
  org: SalesforceOrgUi,
  useQueryParamsInCacheKey?: boolean,
  useBodyInCacheKey?: boolean
): Promise<CacheItemWithData<T> | null> {
  const cacheKey = getCacheKey(config, useQueryParamsInCacheKey, useBodyInCacheKey);
  const cacheItem = await localforage.getItem<OrgCacheItem<T>>(`${INDEXED_DB.KEYS.httpCache}:${org.uniqueId}`);
  const item = cacheItem && cacheItem[cacheKey];
  if (item && !isExpired(item.exp)) {
    return item;
  }
  return null;
}

/**
 * SAVE ITEM TO CACHE
 * @param data
 * @param config
 * @param org
 * @param useQueryParamsInCacheKey
 */
async function saveCacheItem<T>(
  data: any,
  config: AxiosRequestConfig,
  org: SalesforceOrgUi,
  useQueryParamsInCacheKey?: boolean,
  useBodyInCacheKey?: boolean
): Promise<CacheItemWithData<T>> {
  try {
    let cacheItem = await localforage.getItem<OrgCacheItem<T>>(`${INDEXED_DB.KEYS.httpCache}:${org.uniqueId}`);
    const cacheKey = getCacheKey(config, useQueryParamsInCacheKey, useBodyInCacheKey);

    cacheItem = cacheItem || {};
    const cacheItemData: CacheItemWithData<T> = {
      age: new Date().getTime(),
      exp: new Date().getTime() + CACHE_TTL,
      key: cacheKey,
      data,
    };

    cacheItem[cacheKey] = cacheItemData;

    await localforage.setItem(`${INDEXED_DB.KEYS.httpCache}:${org.uniqueId}`, cacheItem);
    return cacheItemData;
  } catch (ex) {
    logger.log('[HTTP][CACHE][ERROR]', ex);
    return undefined;
  }
}

function isExpired(priorCacheTime: number): boolean {
  return new Date().getTime() > priorCacheTime;
}

function getCacheKey(config: AxiosRequestConfig, useQueryParamsInCacheKey?: boolean, useBodyInCacheKey?: boolean) {
  const cacheKeys = [config.method, config.url];
  if (useQueryParamsInCacheKey && config.params) {
    cacheKeys.push(
      Object.keys(config.params)
        .sort()
        .map((key) => `${key}=${config.params[key]}`)
        .join('|')
    );
  }
  if (useBodyInCacheKey && config.data) {
    let data = config.data;
    if (!isString(data)) {
      data = JSON.stringify(data);
    }
    data = data.replace(REGEX.NOT_ALPHANUMERIC_OR_UNDERSCORE, '');
    cacheKeys.push(data);
  }
  const cacheKey = `${cacheKeys.join('|')}`;
  return cacheKey;
}
