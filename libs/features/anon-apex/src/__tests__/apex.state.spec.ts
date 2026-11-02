import { INDEXED_DB } from '@jetstream/shared/constants';
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
    expect(localStorage.length).toBe(0);
    await expect(loadAnonymousApexDraft()).resolves.toBe('System.debug(1);');
  });

  it('returns null when there is no draft', async () => {
    await expect(loadAnonymousApexDraft()).resolves.toBeNull();
  });
});
