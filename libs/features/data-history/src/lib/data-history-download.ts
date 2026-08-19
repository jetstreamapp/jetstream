import { logger } from '@jetstream/shared/client-logger';
import { MIME_TYPES } from '@jetstream/shared/constants';
import { copyRecordsToClipboard, saveFile } from '@jetstream/shared/ui-utils';
import { CopyAsDataType, DataHistoryFileKind, DataHistoryItem } from '@jetstream/types';
import { DataHistoryDirectoryPermissionError, readDataHistoryFile } from '@jetstream/ui/data-history';
import copyToClipboard from 'copy-to-clipboard';
import { getDataHistoryDownloadFileName } from './data-history-page.utils';
import {
  DATA_HISTORY_CLIPBOARD_MAX_BYTES,
  DATA_HISTORY_EXPORT_PARSE_MAX_BYTES,
  DataHistoryExportTarget,
  DataHistoryPayloadView,
  findViewForTarget,
  parseDataHistoryPayloadViews,
} from './data-history-payload-views';

export interface DataHistoryErrorInfo {
  type: 'warning' | 'error';
  message: string;
}

/** User-facing message for a failed read of a saved history payload, with a specific hint when folder access was lost. */
export function getDataHistoryReadErrorMessage(ex: unknown): string {
  if (ex instanceof DataHistoryDirectoryPermissionError) {
    return 'Jetstream no longer has permission to your history folder, so this data can’t be read. Re-connect the folder from Data History to restore access.';
  }
  return 'There was a problem reading this data from local storage.';
}

export type DataHistoryExportData =
  /** Parsed tabular data — offer the CSV/Excel/JSON format choice */
  | { type: 'table'; view: DataHistoryPayloadView }
  /** Not convertible (nested JSON, or too large to parse) — serve the stored file as-is */
  | { type: 'raw'; blob: Blob; fileName: string; contentType: 'text/csv' | 'application/json'; reason: 'not-tabular' | 'too-large' }
  | { type: 'missing' };

/**
 * Read a payload IN FULL and parse it for format conversion. Payloads that cannot or should not be
 * parsed (nested JSON shapes, files beyond the parse cap) come back as `raw` so callers can fall
 * back to downloading the stored file directly. Throws on read errors — wrap with
 * `getDataHistoryReadErrorMessage` for display.
 */
export async function loadDataHistoryExportData(
  item: DataHistoryItem,
  kind: DataHistoryFileKind,
  target?: Pick<DataHistoryExportTarget, 'viewId'>,
): Promise<DataHistoryExportData> {
  const file = await readDataHistoryFile(item, kind);
  if (!file) {
    return { type: 'missing' };
  }
  const { blob, fileName, contentType } = file;
  if (blob.size > DATA_HISTORY_EXPORT_PARSE_MAX_BYTES) {
    return { type: 'raw', blob, fileName, contentType, reason: 'too-large' };
  }
  const view = parseExportView(await blob.text(), contentType, target);
  if (!view) {
    return { type: 'raw', blob, fileName, contentType, reason: 'not-tabular' };
  }
  return { type: 'table', view };
}

/** The tabular view a payload converts to for the requested target, or undefined when it has none */
function parseExportView(
  text: string,
  contentType: 'text/csv' | 'application/json',
  target?: Pick<DataHistoryExportTarget, 'viewId'>,
): DataHistoryPayloadView | undefined {
  return findViewForTarget(parseDataHistoryPayloadViews(text, contentType), target ?? {});
}

/** Save a payload in its stored format (used as the fallback when format conversion is not possible) */
export function saveRawDataHistoryFile(item: DataHistoryItem, file: { blob: Blob; fileName: string; contentType: string }): void {
  saveFile(
    file.blob,
    getDataHistoryDownloadFileName(item, file.fileName),
    file.contentType === 'text/csv' ? MIME_TYPES.CSV : MIME_TYPES.JSON,
  );
}

export interface CopyDataHistoryResult {
  success: boolean;
  error?: DataHistoryErrorInfo;
}

const TOO_LARGE_TO_COPY: DataHistoryErrorInfo = {
  type: 'warning',
  message: 'This data is too large to copy to the clipboard. Download it instead.',
};

/**
 * Copy a payload to the clipboard in the requested format (same formats as the query results copy).
 * Reads the FULL payload — the in-modal preview may be truncated — but only up to the clipboard cap:
 * the read is capped AT THE STORE (like the preview) so an oversized payload is never inflated or
 * pulled across IPC just to be refused. Non-tabular payloads can still be copied as JSON (the raw
 * payload text); spreadsheet formats require tabular data.
 */
export async function copyDataHistoryPayloadToClipboard(
  item: DataHistoryItem,
  kind: DataHistoryFileKind,
  format: CopyAsDataType,
  target?: Pick<DataHistoryExportTarget, 'viewId'>,
): Promise<CopyDataHistoryResult> {
  try {
    // One byte past the cap so a payload exactly at it is not refused
    const file = await readDataHistoryFile(item, kind, { maxBytes: DATA_HISTORY_CLIPBOARD_MAX_BYTES + 1 });
    if (!file) {
      return { success: false, error: { type: 'warning', message: 'This data is no longer available on this device.' } };
    }
    if (file.blob.size > DATA_HISTORY_CLIPBOARD_MAX_BYTES) {
      return { success: false, error: TOO_LARGE_TO_COPY };
    }
    const text = await file.blob.text();
    const view = parseExportView(text, file.contentType, target);
    let copied: boolean;
    if (view) {
      copied = await copyRecordsToClipboard(view.rows, format, view.header);
    } else if (format === 'json') {
      copied = await copyToClipboard(text, { format: 'text/plain' });
    } else {
      return {
        success: false,
        error: { type: 'warning', message: 'This data is not in a table format. Copy it as JSON instead.' },
      };
    }
    // The copy itself can fail after the read succeeded — clipboard access refused, or the user
    // gesture expired during the read on a slow backend — and reporting "Copied" then is a lie
    if (!copied) {
      return {
        success: false,
        error: { type: 'error', message: 'The data could not be copied to the clipboard. Try again, or download it instead.' },
      };
    }
    return { success: true };
  } catch (ex) {
    logger.warn('[DATA_HISTORY] Error copying payload to clipboard', ex);
    return { success: false, error: { type: 'error', message: getDataHistoryReadErrorMessage(ex) } };
  }
}
