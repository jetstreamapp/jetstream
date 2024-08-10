/**
 * All code was copied from https://github.com/eliihen/localforage-webExtensionStorage-driver?tab=readme-ov-file
 * MIT licensed
 */
/* eslint-disable @typescript-eslint/no-empty-function */
import { Maybe } from '@jetstream/types';

// Implement the driver here.
interface LocalForageDriver {
  _driver: string;
  _initStorage(options: LocalForageOptions): void;
  _support?: boolean | LocalForageDriverSupportFunc;
  getItem<T>(key: string, callback?: (err?: Maybe<any>, value?: T | null) => void): Promise<T | null>;
  setItem<T>(key: string, value: T, callback?: (err?: Maybe<any>, value?: T) => void): Promise<void>;
  removeItem(key: string, callback?: (err?: Maybe<any>) => void): Promise<void>;
  clear(callback?: (err?: Maybe<any>) => void): Promise<void>;
  length(callback?: (err?: Maybe<any>, numberOfKeys?: number) => void): Promise<number>;
  key(keyIndex: number, callback?: (err: any, key?: string) => void): Promise<string>;
  keys(callback?: (err?: Maybe<any>, keys?: string[]) => void): Promise<string[]>;
  iterate<T, U>(
    iteratee: (value: T, key: string, iterationNumber: number) => U,
    callback?: (err?: Maybe<any>, result?: U) => void
  ): Promise<any>;
  dropInstance?: LocalForageDropInstanceFn;
}

interface LocalForageDropInstanceFn {
  (dbInstanceOptions?: LocalForageDbInstanceOptions, callback?: (err: any) => void): Promise<void>;
}

interface LocalForageDriverSupportFunc {
  (): Promise<boolean>;
}

interface LocalForageDbInstanceOptions {
  name?: string;
  storeName?: string;
}

interface LocalForageOptions extends LocalForageDbInstanceOptions {
  driver?: string | string[];
  size?: number;
  version?: number;
  description?: string;
}

export const LOCAL_DRIVER_NAME = 'webExtensionLocalStorage';
export const localDriver = createDriver('webExtensionLocalStorage', 'local');

export const SYNC_DRIVER_NAME = 'webExtensionSyncStorage';
export const syncDriver = createDriver('webExtensionSyncStorage', 'sync');

/**
 * Need to invoke a function at runtime instead of import-time to make tests
 * pass with mocked browser and chrome objects
 */
function getStorage() {
  // @ts-expect-error browser and chrome are global objects
  return (typeof browser !== 'undefined' && browser.storage) || (typeof chrome !== 'undefined' && chrome.storage);
}

/**
 * Need to invoke a function at runtime instead of import-time to make tests
 * pass with mocked browser and chrome objects
 */
function usesPromises() {
  const storage = getStorage();
  try {
    return storage && storage.local.get && storage.local.get() && typeof storage.local.get().then === 'function';
  } catch (e) {
    return false;
  }
}

/**
 * Converts a callback-based API to a promise based API.
 * For now we assume that there is only one arg in addition to the callback
 */
function usePromise(fn: (...args: any) => void, arg: any) {
  if (usesPromises()) {
    return fn(arg);
  }

  return new Promise((resolve) => {
    fn(arg, (...data: unknown[]) => {
      // @ts-expect-error - this should be valid, but TS cannot infer it
      resolve(...data);
    });
  });
}

function createDriver(name: string, property: string): LocalForageDriver {
  const storage = getStorage();
  const support = !!(storage && storage[property]);

  const driver = support
    ? storage[property]
    : {
        clear() {},
        get() {},
        remove() {},
        set() {},
      };
  const clear = driver.clear.bind(driver);
  const get = driver.get.bind(driver);
  const remove = driver.remove.bind(driver);
  const set = driver.set.bind(driver);

  const driverObj: LocalForageDriver = {
    _driver: name,
    _support: support,
    // eslint-disable-next-line no-underscore-dangle
    _initStorage() {
      return Promise.resolve();
    },

    async clear(callback) {
      clear();

      if (callback) callback();
    },

    async iterate(iterator, callback) {
      const items = (await usePromise(get, null)) as any;
      const keys = Object.keys(items);
      keys.forEach((key, i) => iterator(items[key], key, i));

      if (callback) callback(null);
    },

    async getItem(key, callback) {
      try {
        let result = (await usePromise(get, key)) as any;
        result = typeof key === 'string' ? result[key] : result;
        result = result === undefined ? null : result;

        if (callback) callback(null, result);
        return result;
      } catch (e) {
        if (callback) callback(e);
        throw e;
      }
    },

    async key(numberOfKeys, callback) {
      const results = (await usePromise(get, null)) as any;
      const key = Object.keys(results)[numberOfKeys];

      if (callback) callback(key);
      return key;
    },

    async keys(callback) {
      const results = (await usePromise(get, null)) as any;
      const keys = Object.keys(results);

      if (callback) callback(keys);
      return keys;
    },

    async length(callback) {
      const results = (await usePromise(get, null)) as any;
      const { length } = Object.keys(results);

      if (callback) callback(length);
      return length;
    },

    async removeItem(key, callback) {
      await usePromise(remove, key);
      if (callback) callback();
    },

    async setItem(key, value, callback) {
      await usePromise(set, { [key]: value });
      if (callback) callback();
    },
  };
  return driverObj;
}
