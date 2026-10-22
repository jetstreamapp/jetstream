import { DesktopUserPreferences, DesktopUserPreferencesSchema, ElectronAPI } from '@jetstream/desktop/types';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { getAutoSaveDownloadFolder, getDesktopPreferences, onDesktopPreferencesChanged } from '../shared-desktop-helpers';

type PartialElectronApi = Pick<ElectronAPI, 'getPreferences' | 'onPreferencesChanged'>;
const windowWithElectron = window as unknown as { electronAPI?: PartialElectronApi };

function getPreferences(fileDownload: DesktopUserPreferences['fileDownload']): DesktopUserPreferences {
  return DesktopUserPreferencesSchema.parse({ fileDownload });
}

describe('getAutoSaveDownloadFolder', () => {
  test('returns the folder when downloads are saved without prompting', () => {
    expect(getAutoSaveDownloadFolder(getPreferences({ omitPrompt: true, downloadPath: '/Users/me/Downloads' }))).toBe(
      '/Users/me/Downloads',
    );
  });

  test('returns null when the user is asked where to save each download', () => {
    expect(getAutoSaveDownloadFolder(getPreferences({ omitPrompt: false, downloadPath: '/Users/me/Downloads' }))).toBeNull();
  });

  test('returns null when no folder has been chosen', () => {
    expect(getAutoSaveDownloadFolder(getPreferences({ omitPrompt: true, downloadPath: '' }))).toBeNull();
    expect(getAutoSaveDownloadFolder(getPreferences(undefined))).toBeNull();
  });
});

describe('desktop preference access', () => {
  const preferences = getPreferences({ omitPrompt: true, downloadPath: '/Users/me/Downloads' });
  let electronApi: { getPreferences: ReturnType<typeof vi.fn>; onPreferencesChanged: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    electronApi = { getPreferences: vi.fn().mockResolvedValue(preferences), onPreferencesChanged: vi.fn().mockReturnValue(vi.fn()) };
    windowWithElectron.electronAPI = electronApi as unknown as PartialElectronApi;
    globalThis.__IS_DESKTOP__ = true;
  });

  afterEach(() => {
    globalThis.__IS_DESKTOP__ = undefined;
    delete windowWithElectron.electronAPI;
  });

  test('reads and subscribes to preferences on desktop', async () => {
    const callback = vi.fn();
    await expect(getDesktopPreferences()).resolves.toBe(preferences);
    onDesktopPreferencesChanged(callback);
    expect(electronApi.onPreferencesChanged).toHaveBeenCalledWith(callback);
  });

  test('does not touch the IPC bridge outside the desktop app', async () => {
    globalThis.__IS_DESKTOP__ = false;
    await expect(getDesktopPreferences()).resolves.toBeNull();
    expect(onDesktopPreferencesChanged(vi.fn())).toBeTypeOf('function');
    expect(electronApi.getPreferences).not.toHaveBeenCalled();
    expect(electronApi.onPreferencesChanged).not.toHaveBeenCalled();
  });
});
