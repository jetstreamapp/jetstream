import { DATE_FORMATS } from '@jetstream/shared/constants';
import {
  PermissionSetWithProfileRecord,
  PermissionTableFieldCell,
  PermissionTableObjectCell,
  PermissionTableSystemPermissionCell,
  PermissionTableTabVisibilityCell,
} from '@jetstream/types';
import { openWorkbook } from '@jetstreamapp/simple-excel';
import { formatDate } from 'date-fns/format';
import { inflateRawSync } from 'node:zlib';
import { parse } from 'papaparse';
import { describe, expect, it, vi } from 'vitest';
import { generateExcelWorkbookFromTable, generateFieldCsv } from '../permission-manager-export-utils';
import { getFieldColumns, getObjectColumns, getSystemPermissionColumns, getTabVisibilityColumns } from '../permission-manager-table-utils';

const PROFILE_ID = '0PS1t000000Profile';
const PROFILE_GROUP_HEADER = 'System Administrator (Profile)';
const profilesById = {
  [PROFILE_ID]: { Label: 'System Administrator', Profile: { Name: 'System Administrator' } } as PermissionSetWithProfileRecord,
};

/** Object, Field Api Name, Field Label + the four audit columns */
const PREFIX_COLUMN_COUNT = 7;
/** Date headers carry the zone the timestamps are rendered in, which varies by where the test runs */
const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;

const fieldColumns = getFieldColumns([PROFILE_ID], [], profilesById, {});
const objectColumns = getObjectColumns([PROFILE_ID], [], profilesById, {});
const tabVisibilityColumns = getTabVisibilityColumns([PROFILE_ID], [], profilesById, {});
const systemPermissionColumns = getSystemPermissionColumns([PROFILE_ID], [], profilesById, {});

function buildRow(overrides: Partial<PermissionTableFieldCell>): PermissionTableFieldCell {
  return {
    key: `Account.${overrides.apiName}`,
    sobject: 'Account',
    apiName: 'Custom__c',
    label: 'Custom',
    tableLabel: 'Custom (Custom__c)',
    type: 'string',
    allowEditPermission: true,
    permissions: {
      [PROFILE_ID]: { read: true, edit: false } as any,
    },
    ...overrides,
  };
}

const customFieldRow = buildRow({
  createdDate: '2020-04-22T14:48:23.000+0000',
  createdBy: 'Austin Turner',
  lastModifiedDate: '2022-05-15T19:44:02.000+0000',
  lastModifiedBy: 'Someone Else',
});
// Standard fields have no audit data in Salesforce
const standardFieldRow = buildRow({ apiName: 'Name', label: 'Account Name' });

const objectRow: PermissionTableObjectCell = {
  key: 'Account',
  sobject: 'Account',
  apiName: 'Account',
  label: 'Account',
  tableLabel: 'Account (Account)',
  allowEditPermission: true,
  allowViewAllModifyAllPermission: true,
  allowObjectPermission: true,
  permissions: {
    [PROFILE_ID]: { read: true, create: true, edit: false, delete: false, viewAll: true, modifyAll: false, viewAllFields: false } as any,
  },
};

const tabVisibilityRow: PermissionTableTabVisibilityCell = {
  key: 'Account',
  sobject: 'Account',
  apiName: 'Account',
  label: 'Account',
  tableLabel: 'Account (Account)',
  canSetPermission: true,
  permissions: {
    [PROFILE_ID]: { available: true, visible: false } as any,
  },
};

const systemPermissionRow: PermissionTableSystemPermissionCell = {
  key: 'PermissionsApiEnabled',
  sobject: '',
  apiName: 'PermissionsApiEnabled',
  label: 'API Enabled',
  tableLabel: 'API Enabled',
  permissions: {
    [PROFILE_ID]: { enabled: true } as any,
  },
};

function generateWorkbook(
  fieldRows: PermissionTableFieldCell[] = [customFieldRow, standardFieldRow],
  options?: Parameters<typeof generateExcelWorkbookFromTable>[4],
): Promise<Blob> {
  return generateExcelWorkbookFromTable(
    { columns: objectColumns, rows: [objectRow] },
    { columns: tabVisibilityColumns, rows: [tabVisibilityRow] },
    { columns: fieldColumns, rows: fieldRows },
    { columns: systemPermissionColumns, rows: [systemPermissionRow] },
    options,
  );
}

async function readSheetNames(file: Blob): Promise<string[]> {
  const workbook = await openWorkbook(file);
  try {
    return workbook.sheets.map(({ name }) => name);
  } finally {
    await workbook.close();
  }
}

async function readSheetRows(file: Blob, sheetName: string): Promise<unknown[][]> {
  const workbook = await openWorkbook(file);
  try {
    const rows: unknown[][] = [];
    for await (const row of workbook.sheet(sheetName).rows()) {
      rows.push(row);
    }
    return rows;
  } finally {
    await workbook.close();
  }
}

/**
 * Merged ranges are not exposed by the reader, so the raw sheet part is pulled out of the package by hand: find the
 * end of central directory record, walk the central directory and inflate the entry that was asked for.
 *
 * Sheet parts are numbered in the order the sheets were added, which is the order they appear in the workbook.
 */
async function readSheetXml(file: Blob, sheetIndex: number): Promise<string> {
  return readPackagePart(file, `xl/worksheets/sheet${sheetIndex + 1}.xml`);
}

async function readPackagePart(file: Blob, path: string): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();

  let endOfCentralDirectory = bytes.length - 22;
  while (endOfCentralDirectory >= 0 && view.getUint32(endOfCentralDirectory, true) !== 0x06054b50) {
    endOfCentralDirectory--;
  }
  if (endOfCentralDirectory < 0) {
    throw new Error('Not a zip archive: no end of central directory record');
  }

  const entryCount = view.getUint16(endOfCentralDirectory + 10, true);
  let entryOffset = view.getUint32(endOfCentralDirectory + 16, true);

  for (let i = 0; i < entryCount; i++) {
    const compressionMethod = view.getUint16(entryOffset + 10, true);
    const compressedSize = view.getUint32(entryOffset + 20, true);
    const nameLength = view.getUint16(entryOffset + 28, true);
    const extraLength = view.getUint16(entryOffset + 30, true);
    const commentLength = view.getUint16(entryOffset + 32, true);
    const localHeaderOffset = view.getUint32(entryOffset + 42, true);
    const name = decoder.decode(bytes.subarray(entryOffset + 46, entryOffset + 46 + nameLength));

    if (name === path) {
      const localNameLength = view.getUint16(localHeaderOffset + 26, true);
      const localExtraLength = view.getUint16(localHeaderOffset + 28, true);
      const dataStart = localHeaderOffset + 30 + localNameLength + localExtraLength;
      const data = bytes.subarray(dataStart, dataStart + compressedSize);
      return decoder.decode(compressionMethod === 0 ? data : inflateRawSync(data));
    }

    entryOffset += 46 + nameLength + extraLength + commentLength;
  }

  throw new Error(`No entry ${path} in the package`);
}

/** Cells of one row element of a sheet part, as `{ ref, style }` - enough to tell a styled header from plain data */
function getRowCells(sheetXml: string, rowNumber: number): { ref: string; style: string | undefined }[] {
  const rowMatch = sheetXml.match(new RegExp(`<row r="${rowNumber}"[^>]*>(.*?)</row>`, 's'));
  if (!rowMatch) {
    throw new Error(`No row ${rowNumber} in the sheet`);
  }
  return [...rowMatch[1].matchAll(/<c r="([A-Z]+\d+)"(?: s="(\d+)")?/g)].map(([, ref, style]) => ({ ref, style }));
}

describe('generateFieldCsv', () => {
  it('should include the audit columns in the header, before the permission groups', () => {
    const [header1, header2] = parse<string[]>(generateFieldCsv(fieldColumns, [customFieldRow])).data;

    expect(header2.slice(0, PREFIX_COLUMN_COUNT)).toEqual([
      'Object',
      'Field Api Name',
      'Field Label',
      `Created Date (${TIME_ZONE})`,
      'Created By',
      `Last Modified Date (${TIME_ZONE})`,
      'Last Modified By',
    ]);
    // The profile group header sits above its Read/Edit pair, after the prefix
    expect(header1.slice(0, PREFIX_COLUMN_COUNT)).toEqual(Array.from({ length: PREFIX_COLUMN_COUNT }, () => ''));
    expect(header1[PREFIX_COLUMN_COUNT]).toBe(PROFILE_GROUP_HEADER);
    expect(header2.slice(PREFIX_COLUMN_COUNT)).toEqual(['Read', 'Edit']);
  });

  it('should format dates as sortable text and keep the permission values aligned after the prefix', () => {
    const [, , dataRow] = parse<string[]>(generateFieldCsv(fieldColumns, [customFieldRow])).data;

    expect(dataRow.slice(0, 3)).toEqual(['Account', 'Custom__c', 'Custom']);
    // 24 hour and zero padded so the column sorts correctly as text. Not asserted exactly - the value renders in
    // the local timezone, so the date and time parts vary by where the test runs.
    expect(dataRow[3]).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(dataRow[4]).toBe('Austin Turner');
    expect(dataRow[5]).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(dataRow[6]).toBe('Someone Else');
    expect(dataRow.slice(PREFIX_COLUMN_COUNT)).toEqual(['TRUE', 'FALSE']);
  });

  it('should emit empty cells rather than null or undefined for a field with no audit data', () => {
    const [, , dataRow] = parse<string[]>(generateFieldCsv(fieldColumns, [standardFieldRow])).data;
    expect(dataRow.slice(3, PREFIX_COLUMN_COUNT)).toEqual(['', '', '', '']);
  });
});

describe('generateExcelWorkbookFromTable', () => {
  it('should write one sheet per permission type, in tab order', async () => {
    expect(await readSheetNames(await generateWorkbook())).toEqual([
      'Object Permissions',
      'Tab Visibility',
      'Field Permissions',
      'System Permissions',
    ]);
  });

  it('should write two header rows on the field sheet with the audit columns before the permission groups', async () => {
    const [header1, header2] = await readSheetRows(await generateWorkbook(), 'Field Permissions');

    expect(header1).toEqual([...Array.from({ length: PREFIX_COLUMN_COUNT }, () => ''), PROFILE_GROUP_HEADER, '']);
    expect(header2).toEqual([
      'Object',
      'Field Api Name',
      'Field Label',
      `Created Date (${TIME_ZONE})`,
      'Created By',
      `Last Modified Date (${TIME_ZONE})`,
      'Last Modified By',
      'Read',
      'Edit',
    ]);
  });

  it('should write audit dates as native date cells so they can be sorted and filtered in excel', async () => {
    const [, , dataRow] = await readSheetRows(await generateWorkbook([customFieldRow]), 'Field Permissions');
    const [, , csvRow] = parse<string[]>(generateFieldCsv(fieldColumns, [customFieldRow])).data;

    expect(dataRow[3]).toBeInstanceOf(Date);
    expect(dataRow[5]).toBeInstanceOf(Date);
    // Both exports render the same local time - asserted against the csv rather than a literal because the
    // rendering depends on the timezone the test runs in
    expect(formatDate(dataRow[3] as Date, DATE_FORMATS.yyyy_MM_dd_HH_mm_ss)).toBe(csvRow[3]);
    expect(formatDate(dataRow[5] as Date, DATE_FORMATS.yyyy_MM_dd_HH_mm_ss)).toBe(csvRow[5]);
    // The columns beside them stay text, and the permission values follow the prefix
    expect(dataRow.slice(0, 3)).toEqual(['Account', 'Custom__c', 'Custom']);
    expect(dataRow[4]).toBe('Austin Turner');
    expect(dataRow[6]).toBe('Someone Else');
    expect(dataRow.slice(PREFIX_COLUMN_COUNT)).toEqual(['TRUE', 'FALSE']);
  });

  it('should give the audit date cells the same number format the csv renders', async () => {
    const styles = await readPackagePart(await generateWorkbook([customFieldRow]), 'xl/styles.xml');
    const [dateCell] = getRowCells(await readSheetXml(await generateWorkbook([customFieldRow]), 2), 3).slice(3);

    expect(styles).toContain('yyyy-mm-dd hh:mm:ss');
    expect(dateCell.ref).toBe('D3');
    expect(dateCell.style).toBeDefined();
  });

  it('should leave the audit cells empty for a field with no audit data', async () => {
    const [, , dataRow] = await readSheetRows(await generateWorkbook([standardFieldRow]), 'Field Permissions');

    expect(dataRow.slice(3, PREFIX_COLUMN_COUNT)).toEqual(['', '', '', '']);
  });

  it('should write the object, tab visibility and system permission sheets with their own headers and values', async () => {
    const file = await generateWorkbook();

    const [objectHeader1, objectHeader2, objectDataRow] = await readSheetRows(file, 'Object Permissions');
    expect(objectHeader1).toEqual(['', PROFILE_GROUP_HEADER, '', '', '', '', '', '']);
    expect(objectHeader2).toEqual(['Object', 'Read', 'Create', 'Edit', 'Delete', 'View All', 'Modify All', 'View All Fields']);
    expect(objectDataRow).toEqual(['Account', 'TRUE', 'TRUE', 'FALSE', 'FALSE', 'TRUE', 'FALSE', 'FALSE']);

    const [tabHeader1, tabHeader2, tabDataRow] = await readSheetRows(file, 'Tab Visibility');
    expect(tabHeader1).toEqual(['', PROFILE_GROUP_HEADER, '']);
    expect(tabHeader2).toEqual(['Object', 'Available', 'Visible']);
    expect(tabDataRow).toEqual(['Account', 'TRUE', 'FALSE']);

    const [systemHeader, systemDataRow] = await readSheetRows(file, 'System Permissions');
    expect(systemHeader).toEqual(['System Permission', 'API Name', PROFILE_GROUP_HEADER]);
    expect(systemDataRow).toEqual(['API Enabled', 'PermissionsApiEnabled', 'TRUE']);
  });

  it('should merge each group header across the columns it covers', async () => {
    const file = await generateWorkbook();

    // 7 permission columns per group on the object sheet, 2 on tab visibility, and 2 on the field sheet - which
    // starts after the 7 prefix columns
    expect(await readSheetXml(file, 0)).toContain('<mergeCell ref="B1:H1"/>');
    expect(await readSheetXml(file, 1)).toContain('<mergeCell ref="B1:C1"/>');
    expect(await readSheetXml(file, 2)).toContain('<mergeCell ref="H1:I1"/>');
    // System permissions have one header row and one column per profile, so nothing is merged
    expect(await readSheetXml(file, 3)).not.toContain('<mergeCell');
  });

  it('should write both header rows in bold and leave the data rows unstyled', async () => {
    const sheetXml = await readSheetXml(await generateWorkbook([customFieldRow]), 2);
    const styles = await readPackagePart(await generateWorkbook([customFieldRow]), 'xl/styles.xml');

    expect(styles).toContain('<b/>');
    getRowCells(sheetXml, 1).forEach(({ style }) => expect(style).toBeDefined());
    getRowCells(sheetXml, 2).forEach(({ style }) => expect(style).toBeDefined());
    // Only the audit date cells carry a style on a data row
    expect(
      getRowCells(sheetXml, 3)
        .filter(({ style }) => style !== undefined)
        .map(({ ref }) => ref),
    ).toEqual(['D3', 'F3']);
  });

  it('should truncate a value past excel cell limit and report how many cells were affected', async () => {
    const onCellsTruncated = vi.fn();
    const longLabel = 'a'.repeat(40_000);

    const file = await generateWorkbook([buildRow({ label: longLabel })], { onCellsTruncated });
    const [, , dataRow] = await readSheetRows(file, 'Field Permissions');

    expect(onCellsTruncated).toHaveBeenCalledWith(1);
    expect(dataRow[2]).toHaveLength(32_767);
    expect(dataRow[2]).toMatch(/\.\.\.\(truncated\)$/);
  });

  it('should not report truncation when every value fits', async () => {
    const onCellsTruncated = vi.fn();

    await generateWorkbook([customFieldRow], { onCellsTruncated });

    expect(onCellsTruncated).not.toHaveBeenCalled();
  });
});
