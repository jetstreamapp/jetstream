import { INDEXED_DB } from '@jetstream/shared/constants';
import { STORAGE_KEYS } from '@jetstream/ui/app-state';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadAnonymousApexDraft, saveAnonymousApexDraft } from '../apex.state';

const userStore = vi.hoisted(() => new Map<string, unknown>());

vi.mock('@jetstream/shared/data', () => ({
  getLocalStore: () => ({
    getItem: async (key: string) => (userStore.has(key) ? userStore.get(key) : null),
    setItem: async (key: string, value: unknown) => {
      userStore.set(key, value);
      return value;
    },
  }),
}));

describe('anonymous apex draft', () => {
  beforeEach(() => {
    userStore.clear();
    localStorage.clear();
  });

  it('saves and loads the draft from the per-user store, not shared localStorage', async () => {
    await saveAnonymousApexDraft('System.debug(1);');

    expect(userStore.get(INDEXED_DB.KEYS.anonymousApexDraft)).toBe('System.debug(1);');
    expect(localStorage.getItem(STORAGE_KEYS.ANONYMOUS_APEX_STORAGE_KEY)).toBeNull();
    await expect(loadAnonymousApexDraft()).resolves.toBe('System.debug(1);');
  });

  it('adopts a shared legacy draft once and removes the shared copy', async () => {
    localStorage.setItem(STORAGE_KEYS.ANONYMOUS_APEX_STORAGE_KEY, 'System.debug(2);');

    await expect(loadAnonymousApexDraft()).resolves.toBe('System.debug(2);');
    expect(userStore.get(INDEXED_DB.KEYS.anonymousApexDraft)).toBe('System.debug(2);');
    expect(localStorage.getItem(STORAGE_KEYS.ANONYMOUS_APEX_STORAGE_KEY)).toBeNull();
  });

  it("keeps the user's own draft and still removes a shared legacy draft", async () => {
    userStore.set(INDEXED_DB.KEYS.anonymousApexDraft, 'mine');
    localStorage.setItem(STORAGE_KEYS.ANONYMOUS_APEX_STORAGE_KEY, 'someone else');

    await expect(loadAnonymousApexDraft()).resolves.toBe('mine');
    expect(localStorage.getItem(STORAGE_KEYS.ANONYMOUS_APEX_STORAGE_KEY)).toBeNull();
  });

  it('returns null when there is no draft', async () => {
    await expect(loadAnonymousApexDraft()).resolves.toBeNull();
  });
});
