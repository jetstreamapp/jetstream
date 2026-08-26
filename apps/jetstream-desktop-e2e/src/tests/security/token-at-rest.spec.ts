import { promises as fs } from 'node:fs';
import path from 'node:path';
import { expect, test } from '../../fixtures/fixtures';

test.use({ authenticated: true });

test.describe('Token at rest', () => {
  test.skip(process.platform === 'win32', 'POSIX mode bits are not meaningful on Windows, where NTFS ACLs govern access');

  // Regression guard for the F4 token-at-rest fix. persistence.service.spec.ts covers the
  // format/migration matrix exhaustively but does it against a mocked fs, so it cannot prove the
  // real wiring produces the right permissions on a real disk — that is the only thing asserted here.
  test('the session file is owner-read/write only after the app rewrites it', async ({ mainWindow, userDataDir }) => {
    // The seeded file is written with default permissions; the app tightens it to SECURE_FILE_MODE
    // on its next write, which happens as boot-time checkAuth persists the verified session. The
    // authenticated shell rendering means that write has already landed.
    await expect(mainWindow.getByPlaceholder('Select an Org')).toBeVisible();

    const { mode } = await fs.stat(path.join(userDataDir, 'app-data.json'));
    expect(mode & 0o777).toBe(0o600);
  });
});
