import { clearLocalStorageScope } from '@jetstream/ui/db';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { clearDataHistoryStorageScope, initDataHistory } from '../data-history.service';
import { setHistoryFileStoreForTests } from '../file-store/file-store-factory';
import { getUserScopeDirName } from '../file-store/hashed-dir-names';
import { clearDataHistoryUserScope, getUserScopeDir, hasDataHistoryUserScope, isDataHistoryUserScope } from '../file-store/user-scope';

const USER_A = 'user-a';
const USER_B = 'user-b';

beforeEach(() => {
  // The factory is bypassed in specs, so scope state is the only thing under test here
  setHistoryFileStoreForTests(null);
  clearDataHistoryUserScope();
});

afterEach(() => {
  clearDataHistoryUserScope();
});

describe('data history user scope', () => {
  it('resolves the scope directory for the initialized user', async () => {
    await initDataHistory({ userId: USER_A });
    expect(await getUserScopeDir()).toBe(await getUserScopeDirName(USER_A));
  });

  it('re-scopes when a different user initializes', async () => {
    await initDataHistory({ userId: USER_A });
    await initDataHistory({ userId: USER_B });
    expect(isDataHistoryUserScope(USER_B)).toBe(true);
    expect(isDataHistoryUserScope(USER_A)).toBe(false);
    expect(await getUserScopeDir()).toBe(await getUserScopeDirName(USER_B));
  });

  it('throws rather than falling back to an unscoped root when no user is bound', () => {
    expect(() => getUserScopeDir()).toThrow(/scoped to a user/);
  });

  it('unbinds on explicit teardown', async () => {
    await initDataHistory({ userId: USER_A });
    expect(hasDataHistoryUserScope()).toBe(true);
    clearDataHistoryStorageScope();
    expect(hasDataHistoryUserScope()).toBe(false);
    expect(() => getUserScopeDir()).toThrow();
  });

  /**
   * The regression this guards: file stores are cached in module state that logout does not
   * otherwise touch, so a departing account's store — including a directory handle it already has
   * permission for — would still be resolvable to whoever uses the page next.
   */
  it('unbinds when the local storage scope is cleared, without a second call at the logout site', async () => {
    await initDataHistory({ userId: USER_A });
    expect(hasDataHistoryUserScope()).toBe(true);

    clearLocalStorageScope();

    expect(hasDataHistoryUserScope()).toBe(false);
    expect(() => getUserScopeDir()).toThrow();
  });
});
