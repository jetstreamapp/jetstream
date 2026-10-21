import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { DesktopDownloadLocationNote } from '../options/DesktopDownloadLocationNote';

const getDesktopAutoSaveDownloadFolder = vi.hoisted(() => vi.fn());
vi.mock('@jetstream/shared/ui-utils', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@jetstream/shared/ui-utils')>()),
  getDesktopAutoSaveDownloadFolder,
}));

function setup() {
  const onNavigateToSettings = vi.fn();
  render(
    <MemoryRouter initialEntries={['/query']}>
      <Routes>
        <Route path="/query" element={<DesktopDownloadLocationNote onNavigateToSettings={onNavigateToSettings} />} />
        <Route path="/settings" element={<div>Settings page</div>} />
      </Routes>
    </MemoryRouter>,
  );
  return { onNavigateToSettings };
}

describe('DesktopDownloadLocationNote', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  test('shows the auto-save folder and links to Settings', async () => {
    getDesktopAutoSaveDownloadFolder.mockResolvedValue('/Users/me/Downloads/Jetstream');
    const { onNavigateToSettings } = setup();

    expect((await screen.findByTestId('desktop-download-location')).textContent).toContain('/Users/me/Downloads/Jetstream');

    await userEvent.click(screen.getByRole('link', { name: 'Change in Settings' }));

    expect(onNavigateToSettings).toHaveBeenCalled();
    expect(screen.getByText('Settings page')).toBeTruthy();
  });

  test('renders nothing when there is no auto-save folder', async () => {
    getDesktopAutoSaveDownloadFolder.mockResolvedValue(null);
    setup();

    await vi.waitFor(() => expect(getDesktopAutoSaveDownloadFolder).toHaveBeenCalled());
    expect(screen.queryByTestId('desktop-download-location')).toBeNull();
  });

  test('renders nothing when preferences cannot be read', async () => {
    getDesktopAutoSaveDownloadFolder.mockRejectedValue(new Error('IPC failed'));
    setup();

    await vi.waitFor(() => expect(getDesktopAutoSaveDownloadFolder).toHaveBeenCalled());
    expect(screen.queryByTestId('desktop-download-location')).toBeNull();
  });
});
