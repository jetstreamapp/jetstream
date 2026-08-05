import { describe, expect, it } from 'vitest';
import { DEXIE_DB_BASE_NAME, getScopedDexieDbName } from '../ui-db';

describe('getScopedDexieDbName', () => {
  it('scopes the database name by a hash of the user id', async () => {
    const name = await getScopedDexieDbName('user-123');
    // 40 hex chars = SHA-1
    expect(name).toMatch(new RegExp(`^${DEXIE_DB_BASE_NAME}-u-[0-9a-f]{40}$`));
  });

  it('is deterministic for the same user id', async () => {
    const first = await getScopedDexieDbName('user-123');
    const second = await getScopedDexieDbName('user-123');
    expect(first).toBe(second);
  });

  it('produces a different name for a different user id', async () => {
    const userA = await getScopedDexieDbName('user-a');
    const userB = await getScopedDexieDbName('user-b');
    expect(userA).not.toBe(userB);
  });

  it('never uses the raw user id in the name', async () => {
    const userId = 'super-secret-user-id';
    const name = await getScopedDexieDbName(userId);
    expect(name).not.toContain(userId);
  });

  it('never collides with the un-scoped base name, which the adopt-once migration reads from', async () => {
    expect(DEXIE_DB_BASE_NAME).not.toContain('-u-');
    expect(await getScopedDexieDbName('user-123')).not.toBe(DEXIE_DB_BASE_NAME);
  });
});
