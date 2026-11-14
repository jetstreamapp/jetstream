import { openWorkbook } from '@jetstreamapp/simple-excel';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import * as XLSX from 'xlsx';
import { getFileParseErrorMessage } from '../file-parse-error.utils';
import { writeWorkbookLegacy } from '../legacy-spreadsheet-engine';
import { openLoadMultiObjectTemplateWorkbook, prepareLoadMultiObjectTemplate } from '../load-multi-object-template.utils';
import { setActiveFeatureFlags } from '../shared-feature-flag-utils';
import { EXCEL_MAX_CELL_CHARS, isSimpleExcelEngineEnabled, parseFile, prepareExcelFile } from '../shared-ui-utils';

/**
 * The SheetJS path every spreadsheet read and write takes while the `simple-excel-engine` flag is off. Files written
 * here are read back with the new engine's reader, and files written by the new engine are read here with SheetJS,
 * so a user can move between the two engines mid-rollout without either one refusing the other's files.
 */

const ENCRYPTED_FIXTURE_PATH = 'libs/shared/ui-utils/src/lib/__tests__/fixtures/encrypted-password-test.xlsx';

/** The test runner's working directory is either the workspace root or this project, so the root is found rather than assumed */
function readRepoFile(repoRelativePath: string): Uint8Array {
  let directory = process.cwd();
  while (!existsSync(join(directory, repoRelativePath))) {
    const parentDirectory = dirname(directory);
    if (parentDirectory === directory) {
      throw new Error(`Could not find "${repoRelativePath}" in any directory above ${process.cwd()}`);
    }
    directory = parentDirectory;
  }
  return new Uint8Array(readFileSync(join(directory, repoRelativePath)));
}

async function readSheets(file: Blob): Promise<Record<string, unknown[][]>> {
  const workbook = await openWorkbook(file);
  try {
    const sheets: Record<string, unknown[][]> = {};
    for (const { name } of workbook.sheets) {
      sheets[name] = [];
      for await (const row of workbook.sheet(name).rows()) {
        sheets[name].push(row);
      }
    }
    return sheets;
  } finally {
    await workbook.close();
  }
}

function writeWithSheetJs(sheets: Record<string, unknown[][]>, bookType: XLSX.BookType = 'xlsx'): Uint8Array {
  const workbook = XLSX.utils.book_new();
  for (const [name, rows] of Object.entries(sheets)) {
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), name);
  }
  return new Uint8Array(XLSX.write(workbook, { bookType, type: 'array' }));
}

async function writeWithNewEngine(write: () => Promise<Blob>): Promise<Blob> {
  setActiveFeatureFlags({ 'simple-excel-engine': true });
  try {
    return await write();
  } finally {
    setActiveFeatureFlags({});
  }
}

beforeEach(() => {
  setActiveFeatureFlags({});
});

describe('simple-excel-engine flag', () => {
  it('is off until the signed-in user is given it', () => {
    expect(isSimpleExcelEngineEnabled()).toBe(false);
    setActiveFeatureFlags({ 'simple-excel-engine': true });
    expect(isSimpleExcelEngineEnabled()).toBe(true);
  });
});

describe('parseFile with the flag off', () => {
  it('reads a workbook as records with blank cells as empty strings and blank rows skipped', async () => {
    const bytes = writeWithSheetJs({
      Accounts: [['Name', 'Employees', 'Active'], ['Acme', 12, true], [], ['Globex', undefined, false]],
    });

    await expect(parseFile(bytes, { extension: '.xlsx' })).resolves.toEqual({
      data: [
        { Name: 'Acme', Employees: 12, Active: true },
        { Name: 'Globex', Employees: '', Active: false },
      ],
      headers: ['Name', 'Employees', 'Active'],
      errors: [],
    });
  });

  it('reads date cells as Dates', async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([['When'], [new Date(2024, 1, 29)]], { cellDates: true }), 'Sheet1');
    const bytes = new Uint8Array(XLSX.write(workbook, { bookType: 'xlsx', type: 'array' }));

    const { data } = await parseFile(bytes, { extension: '.xlsx' });

    expect(data[0].When).toBeInstanceOf(Date);
    expect((data[0].When as Date).getFullYear()).toBe(2024);
  });

  it('asks which worksheet to read when there is more than one', async () => {
    const bytes = writeWithSheetJs({ First: [['A'], [1]], Second: [['B'], [2]] });
    const onParsedMultipleWorkbooks = vi.fn().mockResolvedValue('Second');

    const { data, headers } = await parseFile(bytes, { extension: '.xlsx', onParsedMultipleWorkbooks });

    expect(onParsedMultipleWorkbooks).toHaveBeenCalledWith(['First', 'Second']);
    expect(headers).toEqual(['B']);
    expect(data).toEqual([{ B: 2 }]);
  });

  it('reads a file the new engine wrote', async () => {
    const file = await writeWithNewEngine(() => prepareExcelFile([{ Id: '001', Name: 'Acme' }], ['Id', 'Name']));

    const { data, headers } = await parseFile(file, { extension: '.xlsx' });

    expect(headers).toEqual(['Id', 'Name']);
    expect(data).toEqual([{ Id: '001', Name: 'Acme' }]);
  });

  it('still opens a legacy .xls workbook, which the new engine refuses', async () => {
    const bytes = writeWithSheetJs({ Sheet1: [['Name'], ['Acme']] }, 'biff8');

    await expect(parseFile(bytes, { extension: '.xls' })).resolves.toMatchObject({ data: [{ Name: 'Acme' }], headers: ['Name'] });

    setActiveFeatureFlags({ 'simple-excel-engine': true });
    await expect(parseFile(bytes, { extension: '.xls' })).rejects.toMatchObject({ code: 'LEGACY_XLS' });
  });

  it('parses csv bytes as text rather than handing them to SheetJS', async () => {
    const bytes = new TextEncoder().encode('Name,Zip\nAcme,00501\n');

    const { data } = await parseFile(bytes, { extension: '.csv' });

    // SheetJS would have read the zip code as the number 501
    expect(data).toEqual([{ Name: 'Acme', Zip: '00501' }]);
  });

  it('reads a workbook whose name ends in .json as a workbook, with either engine', async () => {
    const bytes = writeWithSheetJs({ Accounts: [['Name'], ['Acme']] });

    expect((await parseFile(bytes, { extension: '.json' })).data).toEqual([{ Name: 'Acme' }]);
    setActiveFeatureFlags({ 'simple-excel-engine': true });
    expect((await parseFile(bytes, { extension: '.json' })).data).toEqual([{ Name: 'Acme' }]);
  });

  it('tells the user to remove the password from an encrypted workbook', async () => {
    const error = await parseFile(readRepoFile(ENCRYPTED_FIXTURE_PATH), { extension: '.xlsx' }).catch((ex: unknown) => ex);

    expect(getFileParseErrorMessage(error)).toBe('Your file is password protected, remove the password and try again.');
  });
});

describe('prepareExcelFile with the flag off', () => {
  it('writes one sheet from an array of records', async () => {
    const file = await prepareExcelFile([{ Id: '001', Name: 'Acme', Count: 3 }], ['Id', 'Name', 'Count']);

    expect(file).toBeInstanceOf(Blob);
    expect(file.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(await readSheets(file)).toEqual({
      Records: [
        ['Id', 'Name', 'Count'],
        ['001', 'Acme', 3],
      ],
    });
  });

  it('writes one sheet per key, from records or from rows, and skips empty sheets', async () => {
    const file = await prepareExcelFile({
      Accounts: [{ Name: 'Acme' }],
      Template: [
        ['Object', 'Account'],
        ['Name', 'Type'],
      ],
      Empty: [],
    });

    expect(await readSheets(file)).toEqual({
      Accounts: [['Name'], ['Acme']],
      Template: [
        ['Object', 'Account'],
        ['Name', 'Type'],
      ],
    });
  });

  it('writes a workbook with one empty sheet when there is nothing to export', async () => {
    const file = await prepareExcelFile({ Empty: [] });

    expect(Object.keys(await readSheets(file))).toEqual(['Records']);
  });

  it('truncates cells over the Excel limit and reports how many', async () => {
    const onCellsTruncated = vi.fn();

    const file = await prepareExcelFile([{ Notes: 'x'.repeat(EXCEL_MAX_CELL_CHARS + 10), Other: 'ok' }], ['Notes', 'Other'], undefined, {
      onCellsTruncated,
    });

    const [, [notes, other]] = (await readSheets(file)).Records;
    expect(onCellsTruncated).toHaveBeenCalledWith(1);
    expect(notes).toHaveLength(EXCEL_MAX_CELL_CHARS);
    expect(notes).toMatch(/\.\.\.\(truncated\)$/);
    expect(other).toBe('ok');
  });

  it('writes an object that was not flattened as JSON instead of dropping it', async () => {
    const file = await prepareExcelFile([{ Owner: { Name: 'Pat' } }], ['Owner']);

    expect((await readSheets(file)).Records[1]).toEqual(['{"Name":"Pat"}']);
  });

  it('sanitizes and de-duplicates sheet names, which SheetJS would otherwise throw on', async () => {
    const file = await prepareExcelFile({ 'Bad:Name/With[Chars]': [{ a: 1 }], A_Very_Long_Custom_Object_Api_Name__c: [{ a: 1 }] });

    expect(Object.keys(await readSheets(file))).toEqual(['Bad_Name_With_Chars_', 'A_Very_Long_Custom_Object_Api_N']);
  });

  it('does not start a write that was already cancelled', async () => {
    await expect(prepareExcelFile([{ a: 1 }], ['a'], undefined, { signal: AbortSignal.abort() })).rejects.toThrow();
  });
});

describe('writeWorkbookLegacy', () => {
  it('writes merged group headers and date cells', async () => {
    const createdDate = new Date(2024, 1, 29, 13, 5, 0);

    const file = await writeWorkbookLegacy([
      {
        name: 'Field Permissions',
        rows: [
          ['', '', 'Admin', ''],
          ['Field', 'Created', 'Read', 'Edit'],
          ['Name', createdDate, 'TRUE', 'FALSE'],
        ],
        merges: ['C1:D1'],
        widthSkipRowIndex: 0,
        dateFormat: 'yyyy-mm-dd hh:mm:ss',
      },
    ]);

    const worksheet = XLSX.read(await file.arrayBuffer(), { cellDates: true, cellNF: true }).Sheets['Field Permissions'];
    expect(worksheet['!merges']).toEqual([{ s: { r: 0, c: 2 }, e: { r: 0, c: 3 } }]);
    expect(worksheet['B3'].z).toBe('yyyy-mm-dd hh:mm:ss');
    // The date is checked through the new engine's reader, which hands back the wall-clock time that was written
    expect((await readSheets(file))['Field Permissions'][2]).toEqual(['Name', createdDate, 'TRUE', 'FALSE']);
  });
});

describe('openLoadMultiObjectTemplateWorkbook with the flag off', () => {
  it('reads back a template the new engine wrote', async () => {
    const template = prepareLoadMultiObjectTemplate({
      sobject: 'Account',
      fields: ['Id', 'Name'],
      records: [{ Id: '001', Name: 'Acme' }],
      subqueryFields: {},
      childRelationships: [],
    });
    const [sheetName] = Object.keys(template);
    const file = await writeWithNewEngine(() => prepareExcelFile(template));

    const workbook = await openLoadMultiObjectTemplateWorkbook(file);
    const sheet = await workbook.readSheet(sheetName);
    await workbook.close();

    expect(workbook.sheetNames).toEqual([sheetName]);
    expect(sheet.sobject).toBe('Account');
    expect(sheet.columnHeaders).toEqual(template[sheetName][4].map(String));
    expect(sheet.dataRows).toHaveLength(template[sheetName].length - 5);
    expect(sheet.dataRows.every((row) => row.length === sheet.columnHeaders.length)).toBe(true);
  });

  it('reads blank metadata cells as null and pads short rows to the header width', async () => {
    const bytes = writeWithSheetJs({
      Contacts: [['Object', 'Contact'], ['Operation'], [], [], ['Reference Id', 'LastName', 'Email'], ['ref_1', 'Smith']],
    });

    const workbook = await openLoadMultiObjectTemplateWorkbook(bytes);
    const sheet = await workbook.readSheet('Contacts');

    expect(sheet).toEqual({
      sobject: 'Contact',
      operation: null,
      externalId: null,
      referenceIdHeader: 'Reference Id',
      columnHeaders: ['Reference Id', 'LastName', 'Email'],
      dataRows: [['ref_1', 'Smith', '']],
    });
  });

  it('keeps cells past the header width so the loader can warn about them', async () => {
    const bytes = writeWithSheetJs({
      Contacts: [['Object', 'Contact'], ['Operation', 'Insert'], [], [], ['Reference Id', 'LastName'], ['ref_1', 'Smith', 'no header']],
    });

    const workbook = await openLoadMultiObjectTemplateWorkbook(bytes);
    const sheet = await workbook.readSheet('Contacts');

    // SheetJS pads the header row out to the sheet's used range, so the extra column arrives as a blank header
    expect(sheet.columnHeaders).toEqual(['Reference Id', 'LastName', '']);
    expect(sheet.dataRows).toEqual([['ref_1', 'Smith', 'no header']]);
  });
});
