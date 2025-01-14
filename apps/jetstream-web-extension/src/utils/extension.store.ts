import { atom, selector } from 'recoil';
import { setRecoil } from 'recoil-nexus';
import { ChromeStorageState } from './extension.types';

chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' || namespace === 'sync') {
    setRecoil(chromeStorageState, (prevValue) => {
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
      return newState;
    });
  }
});

async function initAuthState(): Promise<ChromeStorageState> {
  const [local, sync] = await Promise.all([
    chrome.storage.local.get(['options', 'connections']),
    chrome.storage.sync.get(['extIdentifier', 'authTokens']),
  ]);
  return {
    local: {
      ...(local as ChromeStorageState['local']),
      options: {
        ...(local as ChromeStorageState['local'])?.options,
        enabled: (local as ChromeStorageState['local'])?.options?.enabled ?? true,
      },
    },
    sync: {
      ...(sync as ChromeStorageState['sync']),
      authTokens: (sync as ChromeStorageState['sync'])?.authTokens ?? null,
      extIdentifier: (sync as ChromeStorageState['sync'])?.extIdentifier ?? null,
    },
  };
}

export const chromeStorageState = atom<ChromeStorageState>({
  key: 'chromeStorageState',
  default: initAuthState(),
});

export const chromeSyncStorage = selector({
  key: 'chromeSyncStorage',
  get: ({ get }) => get(chromeStorageState).sync,
});

export const chromeLocalStorage = selector({
  key: 'chromeLocalStorage',
  get: ({ get }) => get(chromeStorageState).local,
});

export const chromeStorageOptions = selector({
  key: 'chromeStorageOptions',
  get: ({ get }) => get(chromeStorageState).local.options,
});
