import { expect, test } from '../../fixtures/fixtures';

test.describe('Desktop app launch', () => {
  test('launches and shows the Login screen', async ({ mainWindow }) => {
    await expect(mainWindow).toHaveTitle('Jetstream');
    await expect(mainWindow.getByRole('button', { name: 'Login' })).toBeVisible();
  });

  // The two invariants the whole harness rests on. Isolation keeps a test run from reading or
  // clobbering the developer's real desktop session, and `isPackaged === false` is what makes
  // config/environment.ts select the localhost dev URLs the suite talks to.
  test('runs isolated from the real install, against the dev environment', async ({ electronMain, userDataDir }) => {
    expect(await electronMain.userDataPath()).toBe(userDataDir);
    expect(await electronMain.isPackaged()).toBe(false);
  });
});
