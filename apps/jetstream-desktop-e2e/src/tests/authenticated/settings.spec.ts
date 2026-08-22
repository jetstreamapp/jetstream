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
      await expect(mainWindow.getByRole('heading', { name: 'General Settings' })).toBeVisible({ timeout: FIVE_SECONDS });
    }).toPass();
  });
});
