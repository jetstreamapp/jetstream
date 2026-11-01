import { getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import { Maybe } from '@jetstream/types';
import { BrowserWindow, ProgressBarOptions, WebContents } from 'electron';
import logger from 'electron-log';

/** The part of a BrowserWindow the tracker uses, so tests can pass a fake window */
export interface ProgressBarWindow {
  isDestroyed: () => boolean;
  setProgressBar: (progress: number, options?: ProgressBarOptions) => void;
}

export interface DownloadProgress {
  /**
   * @param receivedBytes bytes received so far for this download (a running total, not a delta)
   * @param totalBytes the expected size, for downloads that only learn it after starting
   */
  update: (receivedBytes: number, totalBytes?: Maybe<number>) => void;
  /** Removes the download from the progress bar - safe to call more than once */
  finish: () => void;
}

interface ActiveDownload {
  window: ProgressBarWindow;
  receivedBytes: number;
  /** null when the size is unknown */
  totalBytes: number | null;
}

interface ProgressGroup {
  downloads: Set<ActiveDownload>;
  /** The last state sent to setProgressBar, so frequent updates only call it when the shown value changes */
  renderedState: string | null;
}

interface ProgressBarState {
  key: string;
  progress: number;
  options?: ProgressBarOptions;
}

const APP_GROUP_KEY = 'app';

const CLEARED_STATE: ProgressBarState = { key: 'cleared', progress: -1 };

const NOOP_DOWNLOAD_PROGRESS: DownloadProgress = {
  update: () => undefined,
  finish: () => undefined,
};

function toKnownSize(totalBytes: Maybe<number>): number | null {
  return typeof totalBytes === 'number' && Number.isFinite(totalBytes) && totalBytes > 0 ? totalBytes : null;
}

/**
 * Shows the combined progress of active downloads on the app icon - the Dock on macOS, the taskbar button on Windows.
 *
 * - Progress is total bytes received / total bytes expected across the active downloads.
 * - If any active download has an unknown size the bar is indeterminate. Electron's macOS Dock bar has no
 *   indeterminate rendering (it draws a full bar, which reads as "done"), so macOS shows an empty bar instead.
 * - The macOS Dock icon and the Linux (Unity) launcher entry are shared by the whole app, so downloads from every
 *   window are combined. On Windows each window's taskbar button shows only that window's downloads.
 * - An app-wide bar outlives the windows (macOS keeps running with none open), so a change that could not be shown
 *   because no window was open is kept and shown through the next window - see `renderPending`.
 * - setProgressBar is only called when the whole-number percent (or mode) changes, since data events are frequent.
 */
export function createDownloadProgressTracker({
  platform,
  getFallbackWindow,
}: {
  platform: NodeJS.Platform;
  /** Used to update an app-wide bar when the windows that started the downloads have been closed */
  getFallbackWindow: () => Maybe<ProgressBarWindow>;
}) {
  const isMac = platform === 'darwin';
  const isAppWide = platform !== 'win32';
  const groups = new Map<ProgressBarWindow | typeof APP_GROUP_KEY, ProgressGroup>();

  function getGroupKey(window: ProgressBarWindow) {
    return isAppWide ? APP_GROUP_KEY : window;
  }

  function getProgressBarState(downloads: Set<ActiveDownload>): ProgressBarState {
    if (downloads.size === 0) {
      return CLEARED_STATE;
    }
    let receivedBytes = 0;
    let totalBytes = 0;
    for (const download of downloads) {
      if (download.totalBytes === null) {
        return isMac ? { key: 'indeterminate', progress: 0 } : { key: 'indeterminate', progress: 2, options: { mode: 'indeterminate' } };
      }
      receivedBytes += Math.min(download.receivedBytes, download.totalBytes);
      totalBytes += download.totalBytes;
    }
    // Rounded down so the bar never shows 100% while the file is still being written
    const percent = Math.floor((receivedBytes / totalBytes) * 100);
    return { key: `${percent}`, progress: percent / 100 };
  }

  function getTargetWindow(group: ProgressGroup, sourceWindow: ProgressBarWindow): Maybe<ProgressBarWindow> {
    if (!sourceWindow.isDestroyed()) {
      return sourceWindow;
    }
    if (!isAppWide) {
      return null;
    }
    // The bar is shared by every window, so any open window can update it
    for (const { window } of group.downloads) {
      if (!window.isDestroyed()) {
        return window;
      }
    }
    const fallbackWindow = getFallbackWindow();
    return fallbackWindow && !fallbackWindow.isDestroyed() ? fallbackWindow : null;
  }

  function render(group: ProgressGroup, sourceWindow: ProgressBarWindow) {
    const state = getProgressBarState(group.downloads);
    if (state.key === group.renderedState) {
      return;
    }
    const targetWindow = getTargetWindow(group, sourceWindow);
    if (!targetWindow) {
      return;
    }
    try {
      targetWindow.setProgressBar(state.progress, state.options);
      group.renderedState = state.key;
    } catch (ex) {
      // Never let the progress bar fail a download
      logger.warn('Unable to update the download progress bar', getErrorMessageAndStackObj(ex));
    }
  }

  function start(window: ProgressBarWindow, totalBytes?: Maybe<number>): DownloadProgress {
    const groupKey = getGroupKey(window);
    let group = groups.get(groupKey);
    if (!group) {
      group = { downloads: new Set(), renderedState: null };
      groups.set(groupKey, group);
    }
    const download: ActiveDownload = { window, receivedBytes: 0, totalBytes: toKnownSize(totalBytes) };
    group.downloads.add(download);
    render(group, window);

    let isFinished = false;
    const activeGroup = group;
    return {
      update: (receivedBytes, updatedTotalBytes) => {
        if (isFinished) {
          return;
        }
        download.receivedBytes = receivedBytes;
        if (updatedTotalBytes !== undefined) {
          download.totalBytes = toKnownSize(updatedTotalBytes);
        }
        render(activeGroup, window);
      },
      finish: () => {
        if (isFinished) {
          return;
        }
        isFinished = true;
        activeGroup.downloads.delete(download);
        render(activeGroup, window);
        removeGroupIfDone(groupKey, activeGroup);
      },
    };
  }

  function removeGroupIfDone(groupKey: ProgressBarWindow | typeof APP_GROUP_KEY, group: ProgressGroup) {
    if (group.downloads.size > 0) {
      return;
    }
    // An app-wide bar that could not be cleared (no window was open) is kept so the next window can clear it.
    // A window's own taskbar bar goes away with the window, so there is nothing left to clear.
    if (!isAppWide || group.renderedState === CLEARED_STATE.key) {
      groups.delete(groupKey);
    }
  }

  /**
   * Shows an app-wide bar change that was missed because no window was open, e.g. a Bulk API download that
   * finished after the last macOS window was closed would otherwise leave its progress on the Dock.
   */
  function renderPending(window: ProgressBarWindow) {
    const group = groups.get(APP_GROUP_KEY);
    if (!isAppWide || !group) {
      return;
    }
    render(group, window);
    removeGroupIfDone(APP_GROUP_KEY, group);
  }

  return { start, renderPending };
}

const downloadProgressTracker = createDownloadProgressTracker({
  platform: process.platform,
  getFallbackWindow: () => BrowserWindow.getAllWindows().find((window) => !window.isDestroyed()),
});

/** Call when a window is created, so it can show progress that changed while no window was open */
export function renderPendingDownloadProgress(window: BrowserWindow) {
  downloadProgressTracker.renderPending(window);
}

/**
 * Show a download on the app icon progress bar of the window that owns `webContents`.
 * Always call `finish()` (in a `finally`) so the bar is cleared after a failure or cancel.
 */
export function startDownloadProgress(webContents: Maybe<WebContents>, totalBytes?: Maybe<number>): DownloadProgress {
  const window = webContents && !webContents.isDestroyed() ? BrowserWindow.fromWebContents(webContents) : null;
  if (!window) {
    return NOOP_DOWNLOAD_PROGRESS;
  }
  return downloadProgressTracker.start(window, totalBytes);
}
