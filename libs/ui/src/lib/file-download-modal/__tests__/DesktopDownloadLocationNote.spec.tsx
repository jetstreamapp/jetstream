import { DesktopUserPreferences, DesktopUserPreferencesSchema } from '@jetstream/desktop/types';
import { axeScan } from '@jetstream/test-utils';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { DesktopDownloadLocationNote } from '../options/DesktopDownloadLocationNote';

const { getDesktopPreferences, onDesktopPreferencesChanged, openDesktopSettings } = vi.hoisted(() => ({
  getDesktopPreferences: vi.fn(),
  onDesktopPreferencesChanged: vi.fn(),
  openDesktopSettings: vi.fn(),
}));
vi.mock('@jetstream/shared/ui-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@jetstream/shared/ui-utils')>()),
  getDesktopPreferences,
  onDesktopPreferencesChanged,
  openDesktopSettings,
}));

function getPreferences(downloadPath: string): DesktopUserPreferences {
  return DesktopUserPreferencesSchema.parse({ fileDownload: { omitPrompt: !!downloadPath, downloadPath } });
}

/** Renders the note and returns a function that simulates a save from the Settings window */
function setup(initialPreferences: DesktopUserPreferences | null | Error) {
  if (initialPreferences instanceof Error) {
    getDesktopPreferences.mockRejectedValue(initialPreferences);
  } else {
    getDesktopPreferences.mockResolvedValue(initialPreferences);
  }
  const unsubscribe = vi.fn();
  let emitPreferencesChanged: (preferences: DesktopUserPreferences) => void = () => undefined;
  onDesktopPreferencesChanged.mockImplementation((callback) => {
    emitPreferencesChanged = callback;
    return unsubscribe;
  });
  const { container, unmount } = render(<DesktopDownloadLocationNote />);
  return {
    container,
    emitPreferencesChanged: (preferences: DesktopUserPreferences) => act(() => emitPreferencesChanged(preferences)),
    unsubscribe,
    unmount,
  };
}

describe('DesktopDownloadLocationNote', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test('shows the auto-save folder and opens Settings without closing anything', async () => {
    const { container } = setup(getPreferences('/Users/me/Downloads/Jetstream'));

    expect((await screen.findByTestId('desktop-download-location')).textContent).toContain('/Users/me/Downloads/Jetstream');
    await axeScan(container);

    await userEvent.click(screen.getByRole('button', { name: 'Change in Settings' }));

    expect(openDesktopSettings).toHaveBeenCalledWith('general');
  });

  test('follows changes saved in the Settings window', async () => {
    const { emitPreferencesChanged, unsubscribe, unmount } = setup(getPreferences('/Users/me/Downloads'));
    await screen.findByTestId('desktop-download-location');

    emitPreferencesChanged(getPreferences('/Volumes/Shared/Exports'));
    expect(screen.getByTestId('desktop-download-location').textContent).toContain('/Volumes/Shared/Exports');

    emitPreferencesChanged(getPreferences(''));
    expect(screen.queryByTestId('desktop-download-location')).toBeNull();

    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });

  test('renders nothing when there is no auto-save folder', async () => {
    setup(getPreferences(''));

    await vi.waitFor(() => expect(getDesktopPreferences).toHaveBeenCalled());
    expect(screen.queryByTestId('desktop-download-location')).toBeNull();
  });

  test('renders nothing outside the desktop app', async () => {
    setup(null);
    await vi.waitFor(() => expect(getDesktopPreferences).toHaveBeenCalled());
    expect(screen.queryByTestId('desktop-download-location')).toBeNull();
  });

  test('renders nothing when preferences cannot be read', async () => {
    setup(new Error('IPC failed'));
    await vi.waitFor(() => expect(getDesktopPreferences).toHaveBeenCalled());
    expect(screen.queryByTestId('desktop-download-location')).toBeNull();
  });
});
