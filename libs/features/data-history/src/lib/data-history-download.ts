import { logger } from '@jetstream/shared/client-logger';
import { MIME_TYPES } from '@jetstream/shared/constants';
import { saveFile } from '@jetstream/shared/ui-utils';
import { DataHistoryFileKind, DataHistoryItem } from '@jetstream/types';
import { fireToast } from '@jetstream/ui';
import { readDataHistoryFile } from '@jetstream/ui/data-history';
import { getDataHistoryDownloadFileName } from './data-history-page.utils';

/**
 * Read a saved payload and download it as a decompressed CSV/JSON file, with user-facing toasts on
 * failure. Shared by the table row download menu and the detail modal. Returns true on success.
 */
export async function downloadDataHistoryFile(item: DataHistoryItem, kind: DataHistoryFileKind): Promise<boolean> {
  try {
    const file = await readDataHistoryFile(item, kind);
    if (!file) {
      fireToast({ type: 'warning', message: 'This data is no longer available on this device.' });
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
    fireToast({ type: 'error', message: 'There was a problem reading this data from local storage.' });
    return false;
  }
}
