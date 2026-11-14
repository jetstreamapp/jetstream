import { FILE_FORMAT_XLSX_LOAD_TEMPLATE } from '@jetstream/shared/constants';
import { EXCEL_MAX_CELL_CHARS, formatNumber } from '@jetstream/shared/ui-utils';
import { pluralizeFromNumber } from '@jetstream/shared/utils';
import { FileExtCsv, FileExtJson, FileExtXLSX, FileExtXml, FileExtZip, Maybe } from '@jetstream/types';
import { fireToast } from '../toast/AppToast';

export const RADIO_FORMAT_XLSX: FileExtXLSX = 'xlsx';
/** Excel download in the "Load Records to Multiple Objects" template format - only offered when the modal is given a `loadTemplateOption` */
export const RADIO_FORMAT_XLSX_LOAD_TEMPLATE = FILE_FORMAT_XLSX_LOAD_TEMPLATE;
export const RADIO_FORMAT_CSV: FileExtCsv = 'csv';
export const RADIO_FORMAT_JSON: FileExtJson = 'json';
export const RADIO_FORMAT_GDRIVE = 'gdrive';
export const RADIO_FORMAT_XML: FileExtXml = 'xml';
export const RADIO_FORMAT_ZIP: FileExtZip = 'zip';

export const RADIO_ALL_BROWSER = 'all-browser';
export const RADIO_ALL_SERVER = 'all-server';
export const RADIO_FILTERED = 'filtered';
export const RADIO_SELECTED = 'selected';

export const RADIO_DOWNLOAD_METHOD_STANDARD = 'radio-download-method-standard' as const;
export const RADIO_DOWNLOAD_METHOD_BULK_API = 'radio-download-method-bulk-api' as const;

/**
 * The filtered/selected record subsets are only offered as radio options when they are non-empty
 * and not identical to the full record set. Shared by the radio visibility checks and
 * `getWhichRecordsDefaultValue` so the default value can never point at a hidden option.
 */
export const hasSelectableSubset = (subset: Maybe<unknown[]>, records: unknown[]): boolean => {
  return Array.isArray(subset) && subset.length > 0 && subset.length !== records.length;
};

/**
 * The "Selected records" option is only shown when some, but not all, records are selected.
 * When it is available, it is the default choice since acting on a manual selection is the most likely intent.
 */
export const getWhichRecordsDefaultValue = ({
  hasMoreRecords,
  records,
  selectedRecords,
}: {
  hasMoreRecords: boolean;
  records: unknown[];
  selectedRecords?: Maybe<unknown[]>;
}): string => {
  if (hasSelectableSubset(selectedRecords, records)) {
    return RADIO_SELECTED;
  }
  return hasMoreRecords ? RADIO_ALL_SERVER : RADIO_ALL_BROWSER;
};

/**
 * SheetJS builds each worksheet's XML as one string, so an Excel file fails with `RangeError: Invalid string length` once a
 * sheet passes the browser's ~537M character string limit - after the user has already waited for every record to download.
 * Each cell costs about 34 characters of XML plus its value (measured with SheetJS 0.20.3), which puts the ceiling at
 * 537M / (34 + average value length) cells: about 15.8M cells of empty values, 9.9M at 20 characters and 4.9M at 75.
 * The smallest download seen failing in production was 9.6M cells. This leaves room for values averaging about 70
 * characters, and stays under the 10M cell limit of a Google Sheet.
 */
export const MAX_EXCEL_DOWNLOAD_CELLS = 5_000_000;

/**
 * How many records the download will contain. "All records" pages the rest in from Salesforce after the modal closes, so
 * it is sized from the query's total rather than the records already loaded - Big Objects report a total of -1, which
 * leaves the loaded records as the only known count.
 */
export const getDownloadRecordCount = ({
  downloadRecordsValue,
  totalRecordCount,
  activeRecordCount,
}: {
  downloadRecordsValue: string;
  totalRecordCount?: Maybe<number>;
  activeRecordCount: number;
}): number => {
  if (downloadRecordsValue === RADIO_ALL_SERVER && totalRecordCount && totalRecordCount > activeRecordCount) {
    return totalRecordCount;
  }
  return activeRecordCount;
};

const LS_KEY_PREFIX = 'RECENT_FILE_FORMAT_';
export const getInitialDownloadFileFormat = <T>(allowedTypes: T[], localStorageKey: string): T => {
  try {
    const recentType = localStorage.getItem(`${LS_KEY_PREFIX}${localStorageKey}`);
    if (recentType && allowedTypes.includes(recentType as T)) {
      return recentType as T;
    }
  } catch {
    // do nothing
  }
  return allowedTypes[0];
};

/**
 * A generated .xlsx is not a faithful copy when any cell hit Excel's per-cell limit — the download
 * succeeds either way, so warn the user and point them at a format without the limit.
 * Pass as `onCellsTruncated` to `prepareExcelFile` from any interactive download.
 */
export const notifyExcelCellsTruncated = (truncatedCellCount: number) => {
  fireToast({
    type: 'warning',
    message: `${formatNumber(truncatedCellCount)} ${pluralizeFromNumber('value', truncatedCellCount)} exceeded Excel's ${formatNumber(
      EXCEL_MAX_CELL_CHARS,
    )} character cell limit and ${truncatedCellCount === 1 ? 'was' : 'were'} truncated. Download as CSV or JSON to get the full values.`,
  });
};

export const saveFileFormatToStorage = (type: string, localStorageKey: string) => {
  try {
    localStorage.setItem(`${LS_KEY_PREFIX}${localStorageKey}`, type);
  } catch {
    // do nothing
  }
};
