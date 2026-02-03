import { excelWorkbookToArrayBuffer, getMaxWidthFromColumnContent, initXlsx } from '@jetstream/shared/ui-utils';
import {
  PermissionTableFieldCell,
  PermissionTableObjectCell,
  PermissionTableSummaryRow,
  PermissionTableTabVisibilityCell,
} from '@jetstream/types';
import { ColumnWithFilter } from '@jetstream/ui';
import JSZip from 'jszip';
import { unparse } from 'papaparse';
import * as XLSX from 'xlsx';

initXlsx(XLSX);

type ObjectOrFieldOrTabVisibilityColumn =
  | ColumnWithFilter<PermissionTableObjectCell, PermissionTableSummaryRow>
  | ColumnWithFilter<PermissionTableFieldCell, PermissionTableSummaryRow>
  | ColumnWithFilter<PermissionTableTabVisibilityCell, PermissionTableSummaryRow>;

export function generateExcelWorkbookFromTable(
  objectData: { columns: ObjectOrFieldOrTabVisibilityColumn[]; rows: PermissionTableObjectCell[] },
  tabVisibilityData: { columns: ObjectOrFieldOrTabVisibilityColumn[]; rows: PermissionTableTabVisibilityCell[] },
  fieldData: { columns: ObjectOrFieldOrTabVisibilityColumn[]; rows: PermissionTableFieldCell[] },
) {
  const workbook = XLSX.utils.book_new();
  const objectWorksheet = generateObjectWorksheet(objectData.columns, objectData.rows);
  const tabVisibilityWorksheet = generateTabVisibilityWorksheet(tabVisibilityData.columns, tabVisibilityData.rows);
  const fieldWorksheet = generateFieldWorksheet(fieldData.columns, fieldData.rows);

  XLSX.utils.book_append_sheet(workbook, objectWorksheet, 'Object Permissions');
  XLSX.utils.book_append_sheet(workbook, tabVisibilityWorksheet, 'Tab Visibility');
  XLSX.utils.book_append_sheet(workbook, fieldWorksheet, 'Field Permissions');

  return excelWorkbookToArrayBuffer(workbook, { bookSST: true, compression: true });
}

export async function generateCsvFilesFromTable(
  objectData: { columns: ObjectOrFieldOrTabVisibilityColumn[]; rows: PermissionTableObjectCell[] },
  tabVisibilityData: { columns: ObjectOrFieldOrTabVisibilityColumn[]; rows: PermissionTableTabVisibilityCell[] },
  fieldData: { columns: ObjectOrFieldOrTabVisibilityColumn[]; rows: PermissionTableFieldCell[] },
) {
  const objectCsv = generateObjectCsv(objectData.columns, objectData.rows);
  const tabVisibilityCsv = generateTabVisibilityCsv(tabVisibilityData.columns, tabVisibilityData.rows);
  const fieldCsv = generateFieldCsv(fieldData.columns, fieldData.rows);

  const csvExports = JSZip();

  csvExports.file('object-permissions.csv', objectCsv);
  csvExports.file('tab-visibility.csv', tabVisibilityCsv);
  csvExports.file('field-permissions.csv', fieldCsv);

  const zipFile = await csvExports.generateAsync({
    type: 'arraybuffer',
    compression: 'STORE',
    mimeType: 'application/zip',
    platform: 'UNIX',
  });

  return zipFile;
}

function generateObjectWorksheet(columns: ObjectOrFieldOrTabVisibilityColumn[], rows: PermissionTableObjectCell[]) {
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

  rows.forEach((row, i) => {
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

function generateFieldWorksheet(columns: ObjectOrFieldOrTabVisibilityColumn[], rows: PermissionTableFieldCell[]) {
  const merges: XLSX.Range[] = [];
  const header1: string[] = ['', '', ''];
  const header2: string[] = ['Object', 'Field Api Name', 'Field Label'];
  const excelRows = [header1, header2];

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

  rows.forEach((row, i) => {
    const currRow = [row.sobject, row.apiName, row.label];
    permissionKeys.forEach((key) => {
      const permission = row.permissions[key];
      currRow.push(permission.read ? 'TRUE' : 'FALSE');
      currRow.push(permission.edit ? 'TRUE' : 'FALSE');
    });
    excelRows.push(currRow);
  });

  const worksheet = XLSX.utils.aoa_to_sheet(excelRows);
  worksheet['!cols'] = getMaxWidthFromColumnContent(excelRows, new Set([0]));
  worksheet['!merges'] = merges;
  return worksheet;
}

function generateTabVisibilityWorksheet(columns: ObjectOrFieldOrTabVisibilityColumn[], rows: PermissionTableTabVisibilityCell[]) {
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

  rows.forEach((row, i) => {
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

function generateObjectCsv(columns: ObjectOrFieldOrTabVisibilityColumn[], rows: PermissionTableObjectCell[]) {
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

function generateFieldCsv(columns: ObjectOrFieldOrTabVisibilityColumn[], rows: PermissionTableFieldCell[]) {
  const header1: string[] = ['', '', ''];
  const header2: string[] = ['Object', 'Field Api Name', 'Field Label'];
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
    const currRow = [row.sobject, row.apiName, row.label];
    permissionKeys.forEach((key) => {
      const permission = row.permissions[key];
      currRow.push(permission.read ? 'TRUE' : 'FALSE', permission.edit ? 'TRUE' : 'FALSE');
    });
    csvRows.push(currRow);
  });

  return unparse(csvRows);
}

function generateTabVisibilityCsv(columns: ObjectOrFieldOrTabVisibilityColumn[], rows: PermissionTableTabVisibilityCell[]) {
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
