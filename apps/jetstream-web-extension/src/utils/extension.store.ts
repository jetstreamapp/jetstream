import { UserProfileUi } from '@jetstream/types';
import { atom, createStore } from 'jotai';
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
  const [local, sync] = await Promise.all([
    browser.storage.local.get(['options', 'connections']),
    browser.storage.sync.get(['extIdentifier', 'authTokens', 'buttonPosition']),
  ]);
  return {
    local: {
      ...(local as ChromeStorageState['local']),
      options: {
        ...(local as ChromeStorageState['local'])?.options,
        enabled: (local as ChromeStorageState['local'])?.options?.enabled ?? true,
        recordSyncEnabled: (local as ChromeStorageState['local'])?.options?.recordSyncEnabled ?? false,
      },
    },
    sync: {
      ...(sync as ChromeStorageState['sync']),
      authTokens: (sync as ChromeStorageState['sync'])?.authTokens ?? null,
      extIdentifier: (sync as ChromeStorageState['sync'])?.extIdentifier ?? null,
      buttonPosition: {
        ...DEFAULT_BUTTON_POSITION,
        ...(sync as ChromeStorageState['sync'])?.buttonPosition,
      },
    },
  };
}

export const chromeStorageState = atom<Promise<ChromeStorageState> | ChromeStorageState>(initAuthState());

export const chromeSyncStorage = atom(async (get) => (await get(chromeStorageState)).sync);

export const chromeLocalStorage = atom(async (get) => (await get(chromeStorageState)).local);

export const chromeStorageOptions = atom(async (get) => (await get(chromeStorageState)).local.options);

export const UserProfileState = atom(
  async (get) => (await get(chromeStorageState)).sync?.authTokens?.userProfile as UserProfileUi | undefined
);
