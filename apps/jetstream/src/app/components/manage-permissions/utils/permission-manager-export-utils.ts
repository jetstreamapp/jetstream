import { ColDef, ColGroupDef } from '@ag-grid-community/core';
import { PermissionTableFieldCell } from './permission-manager-table-utils';
import { excelWorkbookToArrayBuffer, getMaxWidthFromColumnContent } from '@jetstream/shared/ui-utils';

import * as XLSX from 'xlsx';

function isColGroupDef(value: any): value is ColGroupDef {
  return Array.isArray(value.children);
}

export function generateExcelWorkbookFromTable(columns: (ColDef | ColGroupDef)[], rows: PermissionTableFieldCell[]) {
  const merges: XLSX.Range[] = [];
  const header1: string[] = ['', '', ''];
  const header2: string[] = ['Object', 'Field Api Name', 'Field Label'];
  const excelRows = [header1, header2];

  const permissionKeys = [];

  columns.forEach((col) => {
    if (isColGroupDef(col)) {
      // header 1
      header1.push(col.headerName);
      header1.push('');
      // merge the two added cells
      merges.push({
        s: { r: 0, c: header1.length - 2 },
        e: { r: 0, c: header1.length - 1 },
      });
      // header 2
      header2.push('Read Access');
      header2.push('Edit Access');
      // keep track of group order to ensure same across all rows
      permissionKeys.push(col.groupId);
    }
  });

  rows.forEach((row, i) => {
    if (!row.fullWidthRow) {
      const currRow = [row.sobject, row.apiName, row.label];
      permissionKeys.forEach((key) => {
        const permission = row.permissions[key];
        currRow.push(permission.read ? 'TRUE' : 'FALSE');
        currRow.push(permission.edit ? 'TRUE' : 'FALSE');
      });
      excelRows.push(currRow);
    }
  });

  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.aoa_to_sheet(excelRows);
  worksheet['!cols'] = getMaxWidthFromColumnContent(excelRows);
  worksheet['!merges'] = merges;
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Field Permissions');

  return excelWorkbookToArrayBuffer(workbook);
}
