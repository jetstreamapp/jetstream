import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { DownloadLocationSetting } from '../Settings';

function DownloadLocationHarness({
  isChoosingFolder = false,
  onChooseFolder = vi.fn(),
}: {
  isChoosingFolder?: boolean;
  onChooseFolder?: () => void;
}) {
  const [downloadPath, setDownloadPath] = useState('/Users/me/Downloads/Jetstream');
  return (
    <DownloadLocationSetting
      downloadPath={downloadPath}
      isChoosingFolder={isChoosingFolder}
      onChooseFolder={onChooseFolder}
      onAskEveryTime={() => setDownloadPath('')}
    />
  );
}

function getDescription(element: HTMLElement) {
  return (element.getAttribute('aria-describedby') ?? '')
    .split(' ')
    .map((id) => document.getElementById(id)?.textContent)
    .join(' ');
}

describe('DownloadLocationSetting', () => {
  test('Ask Every Time moves focus to the folder button it leaves behind', () => {
    render(<DownloadLocationHarness />);
    const askEveryTimeButton = screen.getByRole('button', { name: 'Ask Every Time' });
    askEveryTimeButton.focus();

    fireEvent.click(askEveryTimeButton);

    expect(screen.queryByRole('button', { name: 'Ask Every Time' })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Choose Folder…' }));
  });

  test('both buttons stay focusable and inert while the folder dialog is open', () => {
    const onChooseFolder = vi.fn();
    render(<DownloadLocationHarness isChoosingFolder onChooseFolder={onChooseFolder} />);
    const changeFolderButton = screen.getByRole('button', { name: 'Change Folder…' });
    const askEveryTimeButton = screen.getByRole('button', { name: 'Ask Every Time' });

    for (const button of [changeFolderButton, askEveryTimeButton]) {
      expect(button.getAttribute('aria-disabled')).toBe('true');
      expect(button.hasAttribute('disabled')).toBe(false);
    }

    changeFolderButton.focus();
    fireEvent.click(changeFolderButton);
    fireEvent.click(askEveryTimeButton);

    expect(onChooseFolder).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Ask Every Time' })).toBeTruthy();
    expect(document.activeElement).toBe(changeFolderButton);
  });

  test('describes the buttons with the setting and the folder in use', () => {
    render(<DownloadLocationHarness />);

    for (const name of ['Change Folder…', 'Ask Every Time']) {
      const description = getDescription(screen.getByRole('button', { name }));
      expect(description).toContain('Download location');
      expect(description).toContain('/Users/me/Downloads/Jetstream');
    }
  });
});
