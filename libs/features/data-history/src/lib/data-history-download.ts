import { logger } from '@jetstream/shared/client-logger';
import { MIME_TYPES } from '@jetstream/shared/constants';
import { saveFile } from '@jetstream/shared/ui-utils';
import { DataHistoryFileKind, DataHistoryItem } from '@jetstream/types';
import { fireToast } from '@jetstream/ui';
import { DataHistoryDirectoryPermissionError, readDataHistoryFile } from '@jetstream/ui/data-history';
import { getDataHistoryDownloadFileName } from './data-history-page.utils';

export interface DownloadDataHistoryFileOptions {
  /** Report failures here instead of a toast — used by the detail modal, where toasts are hidden behind the overlay */
  onError?: (info: { type: 'warning' | 'error'; message: string }) => void;
}

/** User-facing message for a failed read of a saved history payload, with a specific hint when folder access was lost. */
export function getDataHistoryReadErrorMessage(ex: unknown): string {
  if (ex instanceof DataHistoryDirectoryPermissionError) {
    return 'Jetstream no longer has permission to your history folder, so this data can’t be read. Re-connect the folder from Data History to restore access.';
  }
  return 'There was a problem reading this data from local storage.';
}

/**
 * Read a saved payload and download it as a decompressed CSV/JSON file. Failures surface as toasts
 * by default, or via `options.onError`. Shared by the table row download menu and the detail modal.
 * Returns true on success.
 */
export async function downloadDataHistoryFile(
  item: DataHistoryItem,
  kind: DataHistoryFileKind,
  options?: DownloadDataHistoryFileOptions,
): Promise<boolean> {
  const reportError = (info: { type: 'warning' | 'error'; message: string }) => (options?.onError ?? fireToast)(info);
  try {
    const file = await readDataHistoryFile(item, kind);
    if (!file) {
      reportError({ type: 'warning', message: 'This data is no longer available on this device.' });
      return false;
    }
    saveFile(
      file.blob,
      getDataHistoryDownloadFileName(item, file.fileName),
      file.contentType === 'text/csv' ? MIME_TYPES.CSV : MIME_TYPES.JSON,
    );
    return true;
  } catch (ex) {
    logger.warn('[DATA_HISTORY] Error downloading file', ex);
    reportError({ type: 'error', message: getDataHistoryReadErrorMessage(ex) });
    return false;
  }
}
