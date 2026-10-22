import type { ElectronApplication, Page } from '@playwright/test';
import { expect, test } from '../../fixtures/fixtures';

test.use({ authenticated: true });

/** Runs `openSettings` and resolves to the Settings window it opens */
async function waitForSettingsWindow(electronApp: ElectronApplication, openSettings: () => Promise<unknown>): Promise<Page> {
  const [settingsWindow] = await Promise.all([electronApp.waitForEvent('window'), openSettings()]);
  await settingsWindow.waitForLoadState('domcontentloaded');
  return settingsWindow;
}

test.describe('Desktop Settings window', () => {
  // The Settings menu item is a native OS menu entry (not part of the DOM), so it can't be clicked through
  // a Playwright locator - this goes through the same IPC the renderer uses to open the window
  test('opens in its own window and leaves the current page in place', async ({ electronApp, electronApiClient, mainWindow }) => {
    await expect(mainWindow.getByPlaceholder('Select an Org')).toBeVisible();

    const settingsWindow = await waitForSettingsWindow(electronApp, () => electronApiClient.invoke('openSettings'));

    await expect(settingsWindow.getByRole('heading', { name: 'General', exact: true })).toBeVisible();
    // Only the Settings page is shown - no app header
    await expect(settingsWindow.getByTestId('header')).toHaveCount(0);
    await expect(mainWindow.getByTestId('settings-page')).toHaveCount(0);
    await expect(mainWindow.getByPlaceholder('Select an Org')).toBeVisible();

    // Opening Settings again focuses the existing window instead of opening another
    await electronApiClient.invoke('openSettings');
    await expect.poll(() => electronApp.windows().length).toBe(2);

    await settingsWindow.close();
  });

  test('applies a theme change made in Settings to the other windows', async ({ electronApp, electronApiClient, mainWindow }) => {
    await expect(mainWindow.getByPlaceholder('Select an Org')).toBeVisible();
    const settingsWindow = await waitForSettingsWindow(electronApp, () => electronApiClient.invoke('openSettings'));

    await settingsWindow.locator('label[for="setting-theme-dark"]').click();
    await expect(mainWindow.locator('body')).toHaveClass(/slds-color-scheme--dark/);

    await settingsWindow.locator('label[for="setting-theme-light"]').click();
    await expect(mainWindow.locator('body')).toHaveClass(/slds-color-scheme--light/);

    await settingsWindow.close();
  });

  // The desktop app has no profile page, so the user menu and the top of Settings are where the signed in account is shown
  test('shows the signed in account from the user menu', async ({ electronApp, mainWindow }) => {
    const avatarButton = mainWindow.getByRole('button', { name: 'Avatar' });
    await expect(avatarButton).toBeVisible();
    const signedInAs = await avatarButton.getAttribute('title');
    expect(signedInAs).toMatch(/^Signed in as .+@.+/);
    const email = signedInAs?.replace('Signed in as ', '');

    await avatarButton.click();
    const settingsWindow = await waitForSettingsWindow(electronApp, () => mainWindow.getByRole('menuitem', { name: 'Account' }).click());

    await expect(settingsWindow.getByTestId('account-summary-email')).toHaveText(email ?? '');
    await expect(settingsWindow.getByRole('button', { name: 'Manage Account' })).toBeVisible();

    await settingsWindow.close();
  });
});
