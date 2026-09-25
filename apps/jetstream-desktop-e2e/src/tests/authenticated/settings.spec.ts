import { expect, test } from '../../fixtures/fixtures';

const FIVE_SECONDS = 5000;

test.use({ authenticated: true });

test.describe('Desktop Settings screen', () => {
  // The Settings menu item is a native OS menu entry (not part of the DOM), so it can't be clicked
  // through a Playwright locator — this replicates exactly what its click handler does
  // (menu.service.ts: `window.webContents.send('open-settings')`) rather than testing a fake shortcut.
  test('opens when the app menu sends the open-settings event', async ({ electronApp, mainWindow }) => {
    // AppRoutes only registers its onOpenSettings IPC listener from a useEffect, and
    // webContents.send() doesn't queue — an event sent before the listener attaches is dropped
    // silently. Waiting on rendered DOM isn't enough of a signal: React commits DOM mutations
    // before it flushes passive effects, so the shell can be visible while the effect has not run.
    // Retry the send instead of trying to detect the exact moment it becomes safe.
    await expect(mainWindow.getByPlaceholder('Select an Org')).toBeVisible();

    await expect(async () => {
      await electronApp.evaluate(({ BrowserWindow }) => {
        BrowserWindow.getAllWindows()[0]?.webContents.send('open-settings');
      });
      await expect(mainWindow.getByRole('heading', { name: 'General', exact: true })).toBeVisible({ timeout: FIVE_SECONDS });
    }).toPass();
  });

  // The desktop app has no profile page, so the user menu and the top of Settings are where the signed in account is shown
  test('shows the signed in account from the user menu', async ({ mainWindow }) => {
    const avatarButton = mainWindow.getByRole('button', { name: 'Avatar' });
    await expect(avatarButton).toBeVisible();
    const signedInAs = await avatarButton.getAttribute('title');
    expect(signedInAs).toMatch(/^Signed in as .+@.+/);
    const email = signedInAs?.replace('Signed in as ', '');

    await avatarButton.click();
    await mainWindow.getByRole('menuitem', { name: 'Account' }).click();

    await expect(mainWindow.getByTestId('account-summary-email')).toHaveText(email ?? '');
    await expect(mainWindow.getByRole('button', { name: 'Manage Account' })).toBeVisible();
  });
});
