/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from '@jetstream/shared/client-logger';
import { INDEXED_DB } from '@jetstream/shared/constants';
import { REGEX } from '@jetstream/shared/utils';
import { CacheItemWithData, MapOf, OrgCacheItem, QueryHistoryItem, SalesforceOrgUi } from '@jetstream/types';
import { AxiosRequestConfig } from 'axios';
import localforage from 'localforage';
import isString from 'lodash/isString';

// 3 days
const CACHE_TTL = 1000 * 60 * 60 * 24 * 3;
// 30 minutes
const SOFT_CACHE_TTL = 1000 * 60 * 30;

/**
 * Checks Salesforce to see if data has changed since last cache if older than SOFT_CACHE_TTL
 * Works for global and sobject describe - core and tooling
 *
 * {@link https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/intro_rest_conditional_requests.htm}
 *
 * @param url
 * @param age
 * @returns
 */
export function shouldCheckIfModified(url: string, age: number) {
  if (url.startsWith('/api/describe')) {
    return age + SOFT_CACHE_TTL <= new Date().getTime();
  }
  return false;
}

export function isExpired(priorCacheTime: number): boolean {
  return new Date().getTime() > priorCacheTime;
}

export async function clearCacheForOrg(org: SalesforceOrgUi) {
  try {
    const key = `${INDEXED_DB.KEYS.httpCache}:${org.uniqueId}`;
    await localforage.removeItem(key);
    logger.log('[HTTP][CACHE][REMOVED]', key);
  } catch (ex) {
    logger.log('[HTTP][CACHE][ERROR]', ex);
  }
}

export async function clearQueryHistoryForOrg(org: SalesforceOrgUi) {
  try {
    const queryHistory = await localforage.getItem<MapOf<QueryHistoryItem>>(INDEXED_DB.KEYS.queryHistory);
    for (const [key] of Object.entries(queryHistory)) {
      if (key.startsWith(org.uniqueId)) {
        queryHistory[key] = undefined;
      }
    }
    await localforage.setItem(INDEXED_DB.KEYS.queryHistory, JSON.parse(JSON.stringify(queryHistory)));
    logger.log('[QUERY-HISTORY][REMOVED]', queryHistory);
  } catch (ex) {
    logger.log('[QUERY-HISTORY][ERROR]', ex);
  }
}

/**
 * Get cached data from HTTP prior request
 *
 * @param data
 * @param config
 * @param org
 * @param useQueryParamsInCacheKey
 */
export async function getCacheItemHttp<T>(
  config: AxiosRequestConfig,
  org?: SalesforceOrgUi,
  useQueryParamsInCacheKey?: boolean,
  useBodyInCacheKey?: boolean
): Promise<CacheItemWithData<T> | null> {
  const orgId = org?.uniqueId || 'unset';
  const cacheKey = getCacheKeyForHttp(config, useQueryParamsInCacheKey, useBodyInCacheKey);
  const cacheItem = await localforage.getItem<OrgCacheItem<T>>(`${INDEXED_DB.KEYS.httpCache}:${orgId}`);
  const item = cacheItem && cacheItem[cacheKey];
  // if item is expired, return null
  // describe calls are never treated as expired since we can use If-Modified-Since header with Salesforce
  if (item && (!isExpired(item.exp) || config.url.startsWith('/api/describe'))) {
    return item;
  }
  return null;
}

/**
 * Get cache from non-http
 *
 * @param data
 * @param config
 * @param org
 * @param useQueryParamsInCacheKey
 */
export async function getCacheItemNonHttp<T>(org: SalesforceOrgUi, key: string): Promise<CacheItemWithData<T> | null> {
  const orgId = org.uniqueId;
  const cacheKey = getCacheKeyForNonHttp(key);
  const cacheItem = await localforage.getItem<OrgCacheItem<T>>(`${INDEXED_DB.KEYS.httpCache}:${orgId}`);
  const item = cacheItem && cacheItem[cacheKey];
  if (item && !isExpired(item.exp)) {
    return item;
  }
  return null;
}

/**
 * Get cache key for HTTP request when the key is already known
 * @param cacheKey
 * @param org
 * @param updateCacheAge if true, cache will be updated with new TTL
 * @returns
 */
export async function getCacheItemFromExistingKey<T>(
  cacheKey: string,
  org?: SalesforceOrgUi,
  updateCacheAge = false
): Promise<CacheItemWithData<T> | null> {
  const orgId = org?.uniqueId || 'unset';
  const cacheItem = await localforage.getItem<OrgCacheItem<T>>(`${INDEXED_DB.KEYS.httpCache}:${orgId}`);
  const item = cacheItem && cacheItem[cacheKey];
  if (item) {
    // treat as fresh if updateCacheAge is true
    if (updateCacheAge) {
      item.age = new Date().getTime();
      item.exp = new Date().getTime() + CACHE_TTL;
      await localforage.setItem(`${INDEXED_DB.KEYS.httpCache}:${orgId}`, cacheItem);
      return item;
    } else if (!isExpired(item.exp)) {
      return item;
    }
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
export async function saveCacheItemHttp<T>(
  data: any,
  config: AxiosRequestConfig,
  org?: SalesforceOrgUi,
  useQueryParamsInCacheKey?: boolean,
  useBodyInCacheKey?: boolean
): Promise<CacheItemWithData<T>> {
  try {
    const cacheKey = getCacheKeyForHttp(config, useQueryParamsInCacheKey, useBodyInCacheKey);
    return saveCacheItem(cacheKey, data, org);
  } catch (ex) {
    logger.log('[HTTP][CACHE][ERROR]', ex);
    return undefined;
  }
}

export async function saveCacheItemNonHttp<T>(data: T, org: SalesforceOrgUi, key: string): Promise<CacheItemWithData<T>> {
  try {
    const cacheKey = getCacheKeyForNonHttp(key);
    return saveCacheItem(cacheKey, data, org);
  } catch (ex) {
    logger.log('[HTTP][CACHE][ERROR]', ex);
    return undefined;
  }
}

/**
 * SAVE ITEM TO CACHE
 * Uses provided key
 */
export async function saveCacheItem<T>(cacheKey: string, data: any, org?: SalesforceOrgUi): Promise<CacheItemWithData<T>> {
  try {
    const orgId = org?.uniqueId || 'unset';
    let cacheItem = await localforage.getItem<OrgCacheItem<T>>(`${INDEXED_DB.KEYS.httpCache}:${orgId}`);

    cacheItem = cacheItem || {};
    const cacheItemData: CacheItemWithData<T> = {
      age: new Date().getTime(),
      exp: new Date().getTime() + CACHE_TTL,
      key: cacheKey,
      data,
    };

    cacheItem[cacheKey] = cacheItemData;

    await localforage.setItem(`${INDEXED_DB.KEYS.httpCache}:${orgId}`, cacheItem);
    return cacheItemData;
  } catch (ex) {
    logger.log('[HTTP][CACHE][ERROR]', ex);
    return undefined;
  }
}

/**
 * Gets cache key HTTP requests
 *
 * @param key
 * @returns
 */
export function getCacheKeyForHttp(config: AxiosRequestConfig, useQueryParamsInCacheKey?: boolean, useBodyInCacheKey?: boolean) {
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

/**
 * Gets cache key for arbitrary cached items that are not from HTTP
 *
 * @param key
 * @returns
 */
function getCacheKeyForNonHttp(key: string) {
  const cacheKeys = ['_', key];
  const cacheKey = `${cacheKeys.join('|')}`;
  return cacheKey;
}
