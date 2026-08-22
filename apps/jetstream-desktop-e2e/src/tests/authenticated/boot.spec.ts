import { expect, test } from '../../fixtures/fixtures';

test.use({ authenticated: true });

test.describe('Desktop authenticated boot', () => {
  test('skips the Login screen when a valid session is seeded', async ({ mainWindow }) => {
    await expect(mainWindow.getByPlaceholder('Select an Org')).toBeVisible();
    await expect(mainWindow.getByRole('button', { name: 'Login' })).not.toBeVisible();
  });

  test('checkAuth resolves with the seeded user profile', async ({ electronApiClient }) => {
    const result = await electronApiClient.invoke('checkAuth');
    expect(result?.userProfile.id).toBeTruthy();
  });
});
