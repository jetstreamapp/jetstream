import { getDataHistoryUserScopeDirName } from '@jetstream/shared/utils';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { expect, test } from '../../fixtures/fixtures';

// Adversarial coverage for data-history-file.service.ts — the one boundary where a malformed
// dataHistoryRequest() payload reaches real `fs` calls in the privileged main process. Two things
// are guarded there and both are exercised here through the real IPC surface:
//
// - `splitRelativePath()` keeps every per-op path inside the scoped base directory.
// - The scope itself is NOT the renderer's to choose: `init` derives the per-user directory from
//   the user the main process knows is signed in (`app-data.json`'s `userProfile.id`, hashed with
//   the shared `getDataHistoryUserScopeDirName`) and refuses any other value, and every op refuses
//   to run until that binding exists. So this channel depends on auth state, and the traversal
//   coverage has to run against a seeded session (`authenticated: true`) to get past `init` at all.

/** A well-formed scope name that is not the seeded user's — the shape a renderer would forge */
const FORGED_SCOPE_DIR = 'u-0000000000000000';

/**
 * The scope the main process derives for the seeded session, computed with the same shared helper
 * it uses, from the same `app-data.json` the `userDataDir` fixture seeded — the only `scopeDir`
 * that `init` accepts.
 */
async function readSeededUserScopeDir(userDataDir: string): Promise<string> {
  const appData = JSON.parse(await fs.readFile(path.join(userDataDir, 'app-data.json'), 'utf8')) as { userProfile?: { id?: unknown } };
  const userId = appData.userProfile?.id;
  if (typeof userId !== 'string') {
    throw new Error(`Expected the seeded app-data.json to carry a userProfile.id, got: ${JSON.stringify(appData.userProfile)}`);
  }
  return getDataHistoryUserScopeDirName(userId);
}

/** `<userData>/data-history/<scope>` — where `data-history-file.service.ts` roots the user's tree by default */
function scopedHistoryDir(userDataDir: string, scopeDir: string): string {
  return path.join(userDataDir, 'data-history', scopeDir);
}

test.describe('Data History IPC — path traversal', () => {
  test.use({ authenticated: true });

  test('binds to the scope derived from the signed-in user and rejects path segments that escape it', async ({
    electronApiClient,
    userDataDir,
  }) => {
    const scopeDir = await readSeededUserScopeDir(userDataDir);
    await electronApiClient.invoke('dataHistoryRequest', { op: 'init', scopeDir });

    // `init` creates the scope directory, so its presence on disk — under the isolated user-data
    // dir, at the name the shared derivation produces — is the proof the tree is rooted where the
    // main process (not the request) says it is.
    const scopeStats = await fs.stat(scopedHistoryDir(userDataDir, scopeDir));
    expect(scopeStats.isDirectory()).toBe(true);

    await expect(
      electronApiClient.invoke('dataHistoryRequest', { op: 'read-file', path: '../../../../etc/passwd', gunzip: false, maxBytes: null }),
    ).rejects.toThrow(/Invalid path segment/);

    await expect(
      electronApiClient.invoke('dataHistoryRequest', {
        op: 'write-file',
        path: '../escape.txt',
        bytes: new Uint8Array([1, 2, 3]),
        gzip: false,
      }),
    ).rejects.toThrow(/Invalid path segment/);

    await expect(electronApiClient.invoke('dataHistoryRequest', { op: 'delete-dir', path: '..' })).rejects.toThrow(/Invalid path segment/);

    // An absolute path's first split segment is empty, which the same regex rejects.
    await expect(
      electronApiClient.invoke('dataHistoryRequest', { op: 'read-file', path: '/etc/passwd', gunzip: false, maxBytes: null }),
    ).rejects.toThrow(/Invalid path segment/);

    // A segment containing characters outside [a-zA-Z0-9._-] — including would-be percent-encoded
    // traversal (`%2e%2e`) — fails the same allowlist regex; there is no decode step to bypass.
    await expect(
      electronApiClient.invoke('dataHistoryRequest', { op: 'read-file', path: '%2e%2e/passwd', gunzip: false, maxBytes: null }),
    ).rejects.toThrow(/Invalid path segment/);
  });

  test('rejects an init whose scope is not the signed-in user’s, and binds nothing', async ({ electronApiClient, userDataDir }) => {
    const scopeDir = await readSeededUserScopeDir(userDataDir);

    // A traversal attempt, a multi-segment name, and a perfectly well-formed scope that simply
    // belongs to someone else all fail the same way: the main process compares against the value
    // it derived itself, so there is no shape of request that selects another account's tree.
    // Assert the specific message so a broken IPC surface (which rejects with `window.electronAPI
    // is not available on this page`) cannot pass this test.
    for (const forgedScopeDir of ['../escape', 'a/b', FORGED_SCOPE_DIR]) {
      await expect(electronApiClient.invoke('dataHistoryRequest', { op: 'init', scopeDir: forgedScopeDir })).rejects.toThrow(
        /does not match the signed-in user/,
      );
    }

    // Each rejected init left the service exactly as it found it: unbound, so even a harmless
    // relative path has nothing to resolve against...
    await expect(
      electronApiClient.invoke('dataHistoryRequest', { op: 'read-file', path: 'org-1/dh_a/manifest.json', gunzip: false, maxBytes: null }),
    ).rejects.toThrow(/has not been initialized for a user/);
    // ...and no directory was created for the forged scope.
    await expect(fs.access(scopedHistoryDir(userDataDir, FORGED_SCOPE_DIR))).rejects.toThrow();

    // The channel itself is healthy — the derived scope still binds, so the failures above were
    // about the scope and not about the IPC surface.
    await electronApiClient.invoke('dataHistoryRequest', { op: 'init', scopeDir });
    await expect(electronApiClient.invoke('dataHistoryRequest', { op: 'list-entry-dirs' })).resolves.toEqual({ dirs: [] });
  });
});

test.describe('Data History IPC — no signed-in user', () => {
  test.use({ authenticated: false });

  test('refuses to bind a scope or run any op', async ({ electronApiClient, userDataDir }) => {
    for (const scopeDir of ['security-test-scope', FORGED_SCOPE_DIR]) {
      await expect(electronApiClient.invoke('dataHistoryRequest', { op: 'init', scopeDir })).rejects.toThrow(/requires a signed-in user/);
    }
    await expect(
      electronApiClient.invoke('dataHistoryRequest', { op: 'read-file', path: 'org-1/dh_a/manifest.json', gunzip: false, maxBytes: null }),
    ).rejects.toThrow(/requires a signed-in user/);
    await expect(electronApiClient.invoke('dataHistoryRequest', { op: 'list-entry-dirs' })).rejects.toThrow(/requires a signed-in user/);

    // Nothing was created: there is no history tree at all for an unauthenticated app
    await expect(fs.access(path.join(userDataDir, 'data-history'))).rejects.toThrow();
  });
});
