import { DesktopUserPreferences } from '@jetstream/desktop/types';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { getDesktopAutoSaveDownloadFolder } from '../shared-desktop-helpers';

const windowWithElectron = window as Window & { electronAPI?: { getPreferences: () => Promise<Partial<DesktopUserPreferences>> } };

function mockPreferences(fileDownload: DesktopUserPreferences['fileDownload']) {
  const getPreferences = vi.fn().mockResolvedValue({ fileDownload });
  windowWithElectron.electronAPI = { getPreferences };
  return getPreferences;
}

describe('getDesktopAutoSaveDownloadFolder', () => {
  beforeEach(() => {
    globalThis.__IS_DESKTOP__ = true;
  });

  afterEach(() => {
    globalThis.__IS_DESKTOP__ = undefined;
    delete windowWithElectron.electronAPI;
  });

  test('returns the folder when downloads are saved without prompting', async () => {
    mockPreferences({ omitPrompt: true, downloadPath: '/Users/me/Downloads' });
    await expect(getDesktopAutoSaveDownloadFolder()).resolves.toBe('/Users/me/Downloads');
  });

  test('returns null when the user is asked where to save each download', async () => {
    mockPreferences({ omitPrompt: false, downloadPath: '/Users/me/Downloads' });
    await expect(getDesktopAutoSaveDownloadFolder()).resolves.toBeNull();
  });

  test('returns null when no folder has been chosen', async () => {
    mockPreferences({ omitPrompt: true, downloadPath: '' });
    await expect(getDesktopAutoSaveDownloadFolder()).resolves.toBeNull();
  });

  test('does not read preferences outside the desktop app', async () => {
    globalThis.__IS_DESKTOP__ = false;
    const getPreferences = mockPreferences({ omitPrompt: true, downloadPath: '/Users/me/Downloads' });
    await expect(getDesktopAutoSaveDownloadFolder()).resolves.toBeNull();
    expect(getPreferences).not.toHaveBeenCalled();
  });
});
