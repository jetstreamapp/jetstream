import { SoqlQueryFormatOptionsSchema, UserProfileUi } from '@jetstream/types';
import { atom, createStore } from 'jotai';
import { loadable, unwrap } from 'jotai/utils';
import browser from 'webextension-polyfill';
import { ChromeStorageState, DEFAULT_BUTTON_POSITION } from './extension.types';

export const extensionStateStore = createStore();

browser.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' || namespace === 'sync') {
    extensionStateStore.set(chromeStorageState, async (_prevValue) => {
      const prevValue = await _prevValue;
      const newState: ChromeStorageState = {
        ...prevValue,
        local: {
          ...prevValue.local,
        },
        sync: {
          ...prevValue.sync,
        },
      };

      for (const [key, { newValue }] of Object.entries(changes)) {
        newState[namespace][key] = newValue;
      }

      newState.local.options = newState.local.options ?? { enabled: true };

      newState.sync.authTokens = newState.sync.authTokens ?? null;
      newState.sync.extIdentifier = newState.sync.extIdentifier ?? null;
      newState.sync.buttonPosition = newState.sync.buttonPosition ?? DEFAULT_BUTTON_POSITION;

      return newState;
    });
  }
});

async function initAuthState(): Promise<ChromeStorageState> {
  const [_local, _sync] = await Promise.all([
    browser.storage.local.get(['options', 'connections']),
    browser.storage.sync.get(['extIdentifier', 'authTokens', 'buttonPosition', 'soqlQueryFormatOptions']),
  ]);
  const local = _local as Partial<ChromeStorageState['local']>;
  const sync = _sync as Partial<ChromeStorageState['sync']>;
  return {
    local: {
      ...local,
      options: {
        ...local?.options,
        enabled: local?.options?.enabled ?? true,
        recordSyncEnabled: local?.options?.recordSyncEnabled ?? false,
      },
    },
    sync: {
      ...sync,
      authTokens: sync?.authTokens ?? null,
      extIdentifier: sync?.extIdentifier ?? null,
      buttonPosition: {
        ...DEFAULT_BUTTON_POSITION,
        ...sync?.buttonPosition,
      },
      soqlQueryFormatOptions: sync?.soqlQueryFormatOptions ?? SoqlQueryFormatOptionsSchema.parse({}),
    },
  };
}

export const chromeStorageAsyncState = atom<Promise<ChromeStorageState> | ChromeStorageState>(initAuthState());
export const chromeStorageLoadable = loadable(chromeStorageAsyncState);
export const chromeStorageLoading = atom((get) => {
  const storage = get(chromeStorageLoadable);
  return storage.state === 'loading' || storage.state !== 'hasData';
});

export const chromeStorageState = unwrap(
  chromeStorageAsyncState,
  (prev) =>
    prev ?? {
      sync: {
        extIdentifier: null,
        authTokens: null,
        buttonPosition: DEFAULT_BUTTON_POSITION,
        soqlQueryFormatOptions: SoqlQueryFormatOptionsSchema.parse({}),
      },
      local: { options: { enabled: true, recordSyncEnabled: false } },
    },
);

export const chromeSyncStorage = atom((get) => get(chromeStorageState).sync);

export const chromeLocalStorage = atom((get) => get(chromeStorageState).local);

export const chromeStorageOptions = atom((get) => get(chromeStorageState).local.options);

export const UserProfileState = atom((get) => get(chromeStorageState)?.sync?.authTokens?.userProfile as UserProfileUi | undefined);
