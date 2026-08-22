import { expect, test } from '../../fixtures/fixtures';

// Adversarial coverage for data-history-file.service.ts's splitRelativePath() — the one boundary
// where a malformed dataHistoryRequest() payload reaches real `fs` calls in the privileged main
// process. Runs against the base (unauthenticated) app: this IPC channel has no auth dependency,
// it's pure filesystem state scoped by `init`'s scopeDir.
test.describe('Data History IPC — path traversal', () => {
  test('rejects path segments that attempt to escape the scoped base directory', async ({ electronApiClient }) => {
    await electronApiClient.invoke('dataHistoryRequest', { op: 'init', scopeDir: 'security-test-scope' });

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

  test('rejects a multi-segment or traversal scopeDir on init', async ({ electronApiClient }) => {
    await expect(electronApiClient.invoke('dataHistoryRequest', { op: 'init', scopeDir: '../escape' })).rejects.toThrow();
    await expect(electronApiClient.invoke('dataHistoryRequest', { op: 'init', scopeDir: 'a/b' })).rejects.toThrow();
  });
});
