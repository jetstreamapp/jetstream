import { DATE_FORMATS } from '@jetstream/shared/constants';
import { ensureXlsxCodepageTable, excelWorkbookToArrayBuffer, getMaxWidthFromColumnContent } from '@jetstream/shared/ui-utils';
import {
  Maybe,
  PermissionTableFieldCell,
  PermissionTableObjectCell,
  PermissionTableSummaryRow,
  PermissionTableSystemPermissionCell,
  PermissionTableTabVisibilityCell,
} from '@jetstream/types';
import { ColumnWithFilter } from '@jetstream/ui';
import { formatDate } from 'date-fns/format';
import { isValid as isDateValid } from 'date-fns/isValid';
import { parseISO } from 'date-fns/parseISO';
import JSZip from 'jszip';
import { unparse } from 'papaparse';
import * as XLSX from 'xlsx';
import { FIELD_AUDIT_COLUMNS, getFieldAuditExportHeaders } from './permission-manager-field-audit-columns';

/**
 * Excel number format for the audit date cells. `hh` is 24 hour here because the format has no AM/PM token, which
 * keeps the worksheet rendering the same as `DATE_FORMATS.yyyy_MM_dd_HH_mm_ss` in the csv.
 */
const AUDIT_DATE_EXCEL_FORMAT = 'yyyy-mm-dd hh:mm:ss';

type PermissionExportColumn =
  | ColumnWithFilter<PermissionTableObjectCell, PermissionTableSummaryRow>
  | ColumnWithFilter<PermissionTableFieldCell, PermissionTableSummaryRow>
  | ColumnWithFilter<PermissionTableTabVisibilityCell, PermissionTableSummaryRow>
  | ColumnWithFilter<PermissionTableSystemPermissionCell, PermissionTableSummaryRow>;

/**
 * Leading columns of the field permissions export, before the per profile / permission set groups.
 *
 * Audit columns are always exported even when hidden in the grid - a spreadsheet has no width pressure, and
 * they are most useful there.
 */
function getFieldExportPrefix(): string[] {
  return ['Object', 'Field Api Name', 'Field Label', ...getFieldAuditExportHeaders()];
}

/** Audit timestamps arrive as raw ISO strings from the Tooling API */
function parseAuditDate(value: Maybe<string>): Date | null {
  if (!value) {
    return null;
  }
  const parsedDate = parseISO(value);
  return isDateValid(parsedDate) ? parsedDate : null;
}

/**
 * Leading columns of a single field row.
 *
 * `formatAuditDate` decides how the date columns are emitted - the csv needs a sortable string while the worksheet
 * needs a real Date, which Excel turns into a native date cell instead of text that cannot be sorted or filtered
 * chronologically.
 */
function getFieldExportRowPrefix<TDateValue extends string | Date>(
  row: PermissionTableFieldCell,
  formatAuditDate: (date: Date) => TDateValue,
): (string | TDateValue)[] {
  return [
    row.sobject,
    row.apiName,
    row.label,
    // Derived from the same list as `getFieldAuditExportHeaders`, so values cannot drift out from under headers
    ...FIELD_AUDIT_COLUMNS.map(({ key, type }) => {
      const value = row[key] ?? '';
      if (type !== 'date') {
        return value;
      }
      const parsedDate = parseAuditDate(value);
      // Keep the raw value rather than dropping data if Salesforce ever returns an unparseable timestamp
      return parsedDate ? formatAuditDate(parsedDate) : value;
    }),
  ];
}

/** 24 hour and zero padded so the column sorts correctly even when a spreadsheet treats it as text */
function getFieldCsvRowPrefix(row: PermissionTableFieldCell): string[] {
  return getFieldExportRowPrefix(row, (date) => formatDate(date, DATE_FORMATS.yyyy_MM_dd_HH_mm_ss));
}

function getFieldWorksheetRowPrefix(row: PermissionTableFieldCell): (string | Date)[] {
  return getFieldExportRowPrefix(row, (date) => date);
}

export function generateExcelWorkbookFromTable(
  objectData: { columns: PermissionExportColumn[]; rows: PermissionTableObjectCell[] },
  tabVisibilityData: { columns: PermissionExportColumn[]; rows: PermissionTableTabVisibilityCell[] },
  fieldData: { columns: PermissionExportColumn[]; rows: PermissionTableFieldCell[] },
  systemPermissionData: { columns: PermissionExportColumn[]; rows: PermissionTableSystemPermissionCell[] },
) {
  ensureXlsxCodepageTable();
  const workbook = XLSX.utils.book_new();
  const objectWorksheet = generateObjectWorksheet(objectData.columns, objectData.rows);
  const tabVisibilityWorksheet = generateTabVisibilityWorksheet(tabVisibilityData.columns, tabVisibilityData.rows);
  const fieldWorksheet = generateFieldWorksheet(fieldData.columns, fieldData.rows);
  const systemPermissionWorksheet = generateSystemPermissionWorksheet(systemPermissionData.columns, systemPermissionData.rows);

  XLSX.utils.book_append_sheet(workbook, objectWorksheet, 'Object Permissions');
  XLSX.utils.book_append_sheet(workbook, tabVisibilityWorksheet, 'Tab Visibility');
  XLSX.utils.book_append_sheet(workbook, fieldWorksheet, 'Field Permissions');
  XLSX.utils.book_append_sheet(workbook, systemPermissionWorksheet, 'System Permissions');

  return excelWorkbookToArrayBuffer(workbook, { bookSST: true, compression: true });
}

export async function generateCsvFilesFromTable(
  objectData: { columns: PermissionExportColumn[]; rows: PermissionTableObjectCell[] },
  tabVisibilityData: { columns: PermissionExportColumn[]; rows: PermissionTableTabVisibilityCell[] },
  fieldData: { columns: PermissionExportColumn[]; rows: PermissionTableFieldCell[] },
  systemPermissionData: { columns: PermissionExportColumn[]; rows: PermissionTableSystemPermissionCell[] },
) {
  const objectCsv = generateObjectCsv(objectData.columns, objectData.rows);
  const tabVisibilityCsv = generateTabVisibilityCsv(tabVisibilityData.columns, tabVisibilityData.rows);
  const fieldCsv = generateFieldCsv(fieldData.columns, fieldData.rows);
  const systemPermissionCsv = generateSystemPermissionCsv(systemPermissionData.columns, systemPermissionData.rows);

  const csvExports = JSZip();

  csvExports.file('object-permissions.csv', objectCsv);
  csvExports.file('tab-visibility.csv', tabVisibilityCsv);
  csvExports.file('field-permissions.csv', fieldCsv);
  csvExports.file('system-permissions.csv', systemPermissionCsv);

  const zipFile = await csvExports.generateAsync({
    type: 'arraybuffer',
    compression: 'STORE',
    mimeType: 'application/zip',
    platform: 'UNIX',
  });

  return zipFile;
}

function generateObjectWorksheet(columns: PermissionExportColumn[], rows: PermissionTableObjectCell[]) {
  const merges: XLSX.Range[] = [];
  const header1: string[] = [''];
  const header2: string[] = ['Object'];
  const excelRows = [header1, header2];

  const permissionKeys: string[] = [];

  columns
    .filter((col) => col.key?.endsWith('-read'))
    .forEach((col) => {
      // header 1
      header1.push(col.name as string);
      header1.push('');
      header1.push('');
      header1.push('');
      header1.push('');
      header1.push('');
      header1.push('');
      // merge the added cells
      merges.push({
        s: { r: 0, c: header1.length - 7 },
        e: { r: 0, c: header1.length - 1 },
      });
      // header 2
      header2.push('Read');
      header2.push('Create');
      header2.push('Edit');
      header2.push('Delete');
      header2.push('View All');
      header2.push('Modify All');
      header2.push('View All Fields');
      // keep track of group order to ensure same across all rows
      permissionKeys.push(col.key.split('-')[0]);
    });

  rows.forEach((row, _i) => {
    const currRow = [row.sobject];
    permissionKeys.forEach((key) => {
      const permission = row.permissions[key];
      currRow.push(permission.read ? 'TRUE' : 'FALSE');
      currRow.push(permission.create ? 'TRUE' : 'FALSE');
      currRow.push(permission.edit ? 'TRUE' : 'FALSE');
      currRow.push(permission.delete ? 'TRUE' : 'FALSE');
      currRow.push(permission.viewAll ? 'TRUE' : 'FALSE');
      currRow.push(permission.modifyAll ? 'TRUE' : 'FALSE');
      currRow.push(permission.viewAllFields ? 'TRUE' : 'FALSE');
    });
    excelRows.push(currRow);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(excelRows);
  worksheet['!cols'] = getMaxWidthFromColumnContent(excelRows, new Set([0]));
  worksheet['!merges'] = merges;
  return worksheet;
}

export function generateFieldWorksheet(columns: PermissionExportColumn[], rows: PermissionTableFieldCell[]) {
  const merges: XLSX.Range[] = [];
  const exportPrefix = getFieldExportPrefix();
  const header1: string[] = exportPrefix.map(() => '');
  const header2: string[] = [...exportPrefix];
  const excelRows: (string | Date)[][] = [header1, header2];

  const permissionKeys: string[] = [];

  columns
    .filter((col) => col.key?.endsWith('-read'))
    .forEach((col) => {
      if (col.colSpan) {
        // header 1
        header1.push(col.name as string);
        header1.push('');
        // merge the added cells
        merges.push({
          s: { r: 0, c: header1.length - 2 },
          e: { r: 0, c: header1.length - 1 },
        });
        // header 2
        header2.push('Read');
        header2.push('Edit');
        // keep track of group order to ensure same across all rows
        // key: `${id}-${actionKey}`,
        permissionKeys.push(col.key.split('-')[0]);
      }
    });

  rows.forEach((row, _i) => {
    const currRow = getFieldWorksheetRowPrefix(row);
    permissionKeys.forEach((key) => {
      const permission = row.permissions[key];
      currRow.push(permission.read ? 'TRUE' : 'FALSE');
      currRow.push(permission.edit ? 'TRUE' : 'FALSE');
    });
    excelRows.push(currRow);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(excelRows, { cellDates: true, dateNF: AUDIT_DATE_EXCEL_FORMAT });
  // Column widths are measured from the stringified value, and a Date stringifies to the full js date string,
  // so the date cells are measured against how Excel will actually render them
  worksheet['!cols'] = getMaxWidthFromColumnContent(
    excelRows.map((row) => row.map((value) => (value instanceof Date ? formatDate(value, DATE_FORMATS.yyyy_MM_dd_HH_mm_ss) : value))),
    new Set([0]),
  );
  worksheet['!merges'] = merges;
  return worksheet;
}

function generateTabVisibilityWorksheet(columns: PermissionExportColumn[], rows: PermissionTableTabVisibilityCell[]) {
  const merges: XLSX.Range[] = [];
  const header1: string[] = [''];
  const header2: string[] = ['Object'];
  const excelRows = [header1, header2];

  const permissionKeys: string[] = [];

  columns
    .filter((col) => col.key?.endsWith('-available'))
    .forEach((col) => {
      // header 1
      header1.push(col.name as string);
      header1.push('');
      // header1.push('');
      // merge the added cells
      merges.push({
        s: { r: 0, c: header1.length - 2 },
        e: { r: 0, c: header1.length - 1 },
      });
      // header 2
      header2.push('Available');
      header2.push('Visible');
      // keep track of group order to ensure same across all rows
      permissionKeys.push(col.key.split('-')[0]);
    });

  rows.forEach((row, _i) => {
    const currRow = [row.sobject];
    permissionKeys.forEach((key) => {
      const permission = row.permissions[key];
      currRow.push(permission.available ? 'TRUE' : 'FALSE');
      currRow.push(permission.visible ? 'TRUE' : 'FALSE');
    });
    excelRows.push(currRow);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(excelRows);
  worksheet['!cols'] = getMaxWidthFromColumnContent(excelRows, new Set([0]));
  worksheet['!merges'] = merges;
  return worksheet;
}

function generateObjectCsv(columns: PermissionExportColumn[], rows: PermissionTableObjectCell[]) {
  const header1: string[] = [''];
  const header2: string[] = ['Object'];
  const csvRows: string[][] = [];

  const permissionKeys: string[] = [];

  columns
    .filter((col) => col.key?.endsWith('-read'))
    .forEach((col) => {
      // header 1 - merged field with 6 blank columns following
      header1.push(col.name as string, '', '', '', '', '', '');
      // header 2
      header2.push('Read', 'Create', 'Edit', 'Delete', 'View All', 'Modify All', 'View All Fields');
      // keep track of group order to ensure same across all rows
      permissionKeys.push(col.key.split('-')[0]);
    });

  csvRows.push(header1, header2);

  rows.forEach((row) => {
    const currRow = [row.sobject];
    permissionKeys.forEach((key) => {
      const permission = row.permissions[key];
      currRow.push(
        permission.read ? 'TRUE' : 'FALSE',
        permission.create ? 'TRUE' : 'FALSE',
        permission.edit ? 'TRUE' : 'FALSE',
        permission.delete ? 'TRUE' : 'FALSE',
        permission.viewAll ? 'TRUE' : 'FALSE',
        permission.modifyAll ? 'TRUE' : 'FALSE',
        permission.viewAllFields ? 'TRUE' : 'FALSE',
      );
    });
    csvRows.push(currRow);
  });

  return unparse(csvRows);
}

export function generateFieldCsv(columns: PermissionExportColumn[], rows: PermissionTableFieldCell[]) {
  const exportPrefix = getFieldExportPrefix();
  const header1: string[] = exportPrefix.map(() => '');
  const header2: string[] = [...exportPrefix];
  const csvRows: string[][] = [];

  const permissionKeys: string[] = [];

  columns
    .filter((col) => col.key?.endsWith('-read'))
    .forEach((col) => {
      if (col.colSpan) {
        // header 1 - merged field with 1 blank column following
        header1.push(col.name as string, '');
        // header 2
        header2.push('Read', 'Edit');
        // keep track of group order to ensure same across all rows
        permissionKeys.push(col.key.split('-')[0]);
      }
    });

  csvRows.push(header1, header2);

  rows.forEach((row) => {
    const currRow = getFieldCsvRowPrefix(row);
    permissionKeys.forEach((key) => {
      const permission = row.permissions[key];
      currRow.push(permission.read ? 'TRUE' : 'FALSE', permission.edit ? 'TRUE' : 'FALSE');
    });
    csvRows.push(currRow);
  });

  return unparse(csvRows);
}

function generateTabVisibilityCsv(columns: PermissionExportColumn[], rows: PermissionTableTabVisibilityCell[]) {
  const header1: string[] = [''];
  const header2: string[] = ['Object'];
  const csvRows: string[][] = [];

  const permissionKeys: string[] = [];

  columns
    .filter((col) => col.key?.endsWith('-available'))
    .forEach((col) => {
      // header 1 - merged field with 1 blank column following
      header1.push(col.name as string, '');
      // header 2
      header2.push('Available', 'Visible');
      // keep track of group order to ensure same across all rows
      permissionKeys.push(col.key.split('-')[0]);
    });

  csvRows.push(header1, header2);

  rows.forEach((row) => {
    const currRow = [row.sobject];
    permissionKeys.forEach((key) => {
      const permission = row.permissions[key];
      currRow.push(permission.available ? 'TRUE' : 'FALSE', permission.visible ? 'TRUE' : 'FALSE');
    });
    csvRows.push(currRow);
  });

  return unparse(csvRows);
}

// System permissions have a single value per profile/permission set, so each column maps to one
// header cell (no merged sub-columns like the object/field/tab sheets).
function generateSystemPermissionWorksheet(columns: PermissionExportColumn[], rows: PermissionTableSystemPermissionCell[]) {
  const header: string[] = ['System Permission', 'API Name'];
  const excelRows = [header];

  const permissionKeys: string[] = [];

  columns
    .filter((col) => col.key?.endsWith('-enabled'))
    .forEach((col) => {
      header.push(col.name as string);
      permissionKeys.push(col.key.split('-')[0]);
    });

  rows.forEach((row) => {
    const currRow = [row.label, row.apiName];
    permissionKeys.forEach((key) => {
      const permission = row.permissions[key];
      currRow.push(permission.enabled ? 'TRUE' : 'FALSE');
    });
    excelRows.push(currRow);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(excelRows);
  worksheet['!cols'] = getMaxWidthFromColumnContent(excelRows, new Set([0, 1]));
  return worksheet;
}

function generateSystemPermissionCsv(columns: PermissionExportColumn[], rows: PermissionTableSystemPermissionCell[]) {
  const header: string[] = ['System Permission', 'API Name'];
  const csvRows: string[][] = [];

  const permissionKeys: string[] = [];

  columns
    .filter((col) => col.key?.endsWith('-enabled'))
    .forEach((col) => {
      header.push(col.name as string);
      permissionKeys.push(col.key.split('-')[0]);
    });

  csvRows.push(header);

  rows.forEach((row) => {
    const currRow = [row.label, row.apiName];
    permissionKeys.forEach((key) => {
      const permission = row.permissions[key];
      currRow.push(permission.enabled ? 'TRUE' : 'FALSE');
    });
    csvRows.push(currRow);
  });

  return unparse(csvRows);
}
