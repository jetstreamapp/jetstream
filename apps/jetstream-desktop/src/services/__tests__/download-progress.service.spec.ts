import { BrowserWindow, WebContents } from 'electron';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createDownloadProgressTracker, ProgressBarWindow, startDownloadProgress } from '../download-progress.service';

vi.mock('electron', () => ({
  BrowserWindow: { fromWebContents: vi.fn(), getAllWindows: vi.fn(() => []) },
}));

vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function createFakeWindow() {
  let isDestroyed = false;
  const window = {
    isDestroyed: vi.fn(() => isDestroyed),
    setProgressBar: vi.fn<ProgressBarWindow['setProgressBar']>(),
    destroy: () => {
      isDestroyed = true;
    },
  };
  return window;
}

function getProgressValues(window: ReturnType<typeof createFakeWindow>) {
  return window.setProgressBar.mock.calls.map(([progress]) => progress);
}

function createTracker(platform: NodeJS.Platform, fallbackWindow: ProgressBarWindow | null = null) {
  return createDownloadProgressTracker({ platform, getFallbackWindow: () => fallbackWindow });
}

describe('download-progress.service', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe.each<NodeJS.Platform>(['win32', 'darwin'])('on %s', (platform) => {
    it('shows the percent received and clears the bar when the download finishes', () => {
      const window = createFakeWindow();
      const download = createTracker(platform).start(window, 1000);

      download.update(250);
      download.update(500);
      download.update(1000);
      download.finish();

      expect(getProgressValues(window)).toEqual([0, 0.25, 0.5, 1, -1]);
    });

    it('only updates the bar when the whole-number percent changes', () => {
      const window = createFakeWindow();
      const download = createTracker(platform).start(window, 10_000);

      for (let receivedBytes = 1; receivedBytes <= 250; receivedBytes++) {
        download.update(receivedBytes);
      }

      // 0% on start, then 1% at 100 bytes and 2% at 200 bytes
      expect(getProgressValues(window)).toEqual([0, 0.01, 0.02]);
    });

    it('combines concurrent downloads as total received over total expected', () => {
      const window = createFakeWindow();
      const tracker = createTracker(platform);
      const smallDownload = tracker.start(window, 100);
      const largeDownload = tracker.start(window, 300);

      smallDownload.update(100);
      largeDownload.update(100);
      smallDownload.finish();

      // 100/400, 200/400, then only the large download remains at 100/300
      expect(getProgressValues(window)).toEqual([0, 0.25, 0.5, 0.33]);

      largeDownload.finish();
      expect(window.setProgressBar).toHaveBeenLastCalledWith(-1, undefined);
    });

    it('uses a size that is only known after the download started', () => {
      const window = createFakeWindow();
      const download = createTracker(platform).start(window);

      download.update(0, 200);
      download.update(100);
      download.finish();

      expect(getProgressValues(window).slice(1)).toEqual([0, 0.5, -1]);
    });

    it('ignores updates after finish and finishing more than once', () => {
      const window = createFakeWindow();
      const download = createTracker(platform).start(window, 100);

      download.finish();
      download.update(50);
      download.finish();

      expect(getProgressValues(window)).toEqual([0, -1]);
    });

    it('never throws when the window cannot show the progress', () => {
      const window = createFakeWindow();
      window.setProgressBar.mockImplementation(() => {
        throw new Error('Object has been destroyed');
      });
      const download = createTracker(platform).start(window, 100);

      expect(() => download.update(50)).not.toThrow();
      expect(() => download.finish()).not.toThrow();
    });
  });

  describe('on Windows', () => {
    it('shows an indeterminate bar while any active download has an unknown size', () => {
      const window = createFakeWindow();
      const tracker = createTracker('win32');
      const knownSize = tracker.start(window, 100);
      const unknownSize = tracker.start(window);

      knownSize.update(50);
      unknownSize.update(5000);
      expect(window.setProgressBar).toHaveBeenLastCalledWith(2, { mode: 'indeterminate' });

      unknownSize.finish();
      expect(window.setProgressBar).toHaveBeenLastCalledWith(0.5, undefined);
    });

    it('shows each window only its own downloads', () => {
      const firstWindow = createFakeWindow();
      const secondWindow = createFakeWindow();
      const tracker = createTracker('win32');
      const firstDownload = tracker.start(firstWindow, 100);
      const secondDownload = tracker.start(secondWindow, 100);

      firstDownload.update(50);
      secondDownload.update(10);
      firstDownload.finish();

      expect(getProgressValues(firstWindow)).toEqual([0, 0.5, -1]);
      expect(getProgressValues(secondWindow)).toEqual([0, 0.1]);
    });

    it('does not update a destroyed window', () => {
      const window = createFakeWindow();
      const download = createTracker('win32').start(window, 100);
      window.destroy();

      download.update(50);
      download.finish();

      expect(getProgressValues(window)).toEqual([0]);
    });
  });

  describe('on macOS', () => {
    it('shows an empty bar instead of a full one while a download has an unknown size', () => {
      const window = createFakeWindow();
      const download = createTracker('darwin').start(window);

      download.update(5000);
      download.finish();

      // Electron draws its indeterminate Dock bar as completely full, so values over 1 are never used
      expect(window.setProgressBar.mock.calls).toEqual([
        [0, undefined],
        [-1, undefined],
      ]);
    });

    it('combines downloads from every window because there is one Dock icon', () => {
      const firstWindow = createFakeWindow();
      const secondWindow = createFakeWindow();
      const tracker = createTracker('darwin');
      const firstDownload = tracker.start(firstWindow, 100);
      const secondDownload = tracker.start(secondWindow, 100);

      firstDownload.update(100);
      firstDownload.finish();
      expect(secondWindow.setProgressBar).not.toHaveBeenCalledWith(-1, undefined);
      expect(firstWindow.setProgressBar).not.toHaveBeenCalledWith(-1, undefined);

      secondDownload.finish();
      expect(secondWindow.setProgressBar).toHaveBeenLastCalledWith(-1, undefined);
    });

    it('clears the Dock bar through another window when the downloading window was closed', () => {
      const closedWindow = createFakeWindow();
      const fallbackWindow = createFakeWindow();
      const download = createTracker('darwin', fallbackWindow).start(closedWindow, 100);
      closedWindow.destroy();

      download.finish();

      expect(getProgressValues(closedWindow)).toEqual([0]);
      expect(getProgressValues(fallbackWindow)).toEqual([-1]);
    });
  });

  describe('startDownloadProgress', () => {
    it('shows progress on the window that owns the web contents', () => {
      const window = createFakeWindow();
      vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(window as unknown as BrowserWindow);
      const webContents = { isDestroyed: () => false } as WebContents;

      const download = startDownloadProgress(webContents, 100);
      download.update(100);
      download.finish();

      expect(BrowserWindow.fromWebContents).toHaveBeenCalledWith(webContents);
      expect(getProgressValues(window)).toEqual([0, 1, -1]);
    });

    it('does nothing without a window', () => {
      vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(null);

      expect(() => {
        startDownloadProgress(null).finish();
        startDownloadProgress({ isDestroyed: () => true } as WebContents).finish();
        startDownloadProgress({ isDestroyed: () => false } as WebContents).finish();
      }).not.toThrow();
      expect(BrowserWindow.fromWebContents).toHaveBeenCalledTimes(1);
    });
  });
});
