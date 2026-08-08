import { logger } from '@jetstream/shared/client-logger';
import { MIME_TYPES } from '@jetstream/shared/constants';
import { copyRecordsToClipboard, saveFile } from '@jetstream/shared/ui-utils';
import { CopyAsDataType, DataHistoryFileKind, DataHistoryItem } from '@jetstream/types';
import { DataHistoryDirectoryPermissionError, readDataHistoryFile } from '@jetstream/ui/data-history';
import copyToClipboard from 'copy-to-clipboard';
import { getDataHistoryDownloadFileName } from './data-history-page.utils';
import {
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
  const text = await blob.text();
  const views = parseDataHistoryPayloadViews(text, contentType);
  const view = findViewForTarget(views, target ?? {});
  if (!view) {
    return { type: 'raw', blob, fileName, contentType, reason: 'not-tabular' };
  }
  return { type: 'table', view };
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

/**
 * Copy a payload to the clipboard in the requested format (same formats as the query results copy).
 * Reads the FULL payload — the in-modal preview may be truncated. Non-tabular payloads can still be
 * copied as JSON (the raw payload text); spreadsheet formats require tabular data.
 */
export async function copyDataHistoryPayloadToClipboard(
  item: DataHistoryItem,
  kind: DataHistoryFileKind,
  format: CopyAsDataType,
  target?: Pick<DataHistoryExportTarget, 'viewId'>,
): Promise<CopyDataHistoryResult> {
  try {
    const exportData = await loadDataHistoryExportData(item, kind, target);
    if (exportData.type === 'missing') {
      return { success: false, error: { type: 'warning', message: 'This data is no longer available on this device.' } };
    }
    if (exportData.type === 'raw') {
      if (exportData.reason === 'too-large') {
        return {
          success: false,
          error: { type: 'warning', message: 'This data is too large to copy to the clipboard. Download it instead.' },
        };
      }
      if (format === 'json') {
        copyToClipboard(await exportData.blob.text(), { format: 'text/plain' });
        return { success: true };
      }
      return {
        success: false,
        error: { type: 'warning', message: 'This data is not in a table format. Copy it as JSON instead.' },
      };
    }
    const { view } = exportData;
    await copyRecordsToClipboard(view.rows, format, view.header);
    return { success: true };
  } catch (ex) {
    logger.warn('[DATA_HISTORY] Error copying payload to clipboard', ex);
    return { success: false, error: { type: 'error', message: getDataHistoryReadErrorMessage(ex) } };
  }
}
