import { openWorkbook } from '@jetstreamapp/simple-excel';
import { EXCEL_MAX_CELL_CHARS, formatNumber, prepareExcelFile } from '../shared-ui-utils';

/** Read a generated workbook back into array-of-array rows for the first sheet */
async function readBackRows(file: Blob, sheetName?: string): Promise<unknown[][]> {
  const workbook = await openWorkbook(file);
  try {
    const rows: unknown[][] = [];
    for await (const row of workbook.sheet(sheetName ?? 0).rows()) {
      rows.push(row);
    }
    return rows;
  } finally {
    await workbook.close();
  }
}

describe('prepareExcelFile', () => {
  it('writes one sheet per key with the header row first and the values typed', async () => {
    const file = await prepareExcelFile(
      {
        records: [
          { Id: 'rec-1', Amount: 1234.5, Active: true, When: new Date(2024, 1, 29, 13, 45, 0) },
          { Id: 'rec-2', Amount: null, Active: false, When: undefined },
        ],
      },
      { records: ['Id', 'Amount', 'Active', 'When'] },
    );

    expect(file.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    const rows = await readBackRows(file, 'records');
    expect(rows[0]).toEqual(['Id', 'Amount', 'Active', 'When']);
    expect(rows[1]).toEqual(['rec-1', 1234.5, true, new Date(2024, 1, 29, 13, 45, 0)]);
    expect(rows[2]).toEqual(['rec-2', null, false]);
  });

  it('auto-detects the header from the first record and names the default sheet Records', async () => {
    const file = await prepareExcelFile([{ Id: 'rec-1', Name: 'Acme' }]);
    const workbook = await openWorkbook(file);
    expect(workbook.sheets.map(({ name }) => name)).toEqual(['Records']);
    await workbook.close();
    expect(await readBackRows(file)).toEqual([
      ['Id', 'Name'],
      ['rec-1', 'Acme'],
    ]);
  });

  it('writes array-of-array sheets as given, including blank rows', async () => {
    const file = await prepareExcelFile({ Account: [['Object Api Name', 'Account'], [], ['Reference Id', 'Name'], ['001', 'Acme']] });
    const rows: unknown[][] = [];
    const workbook = await openWorkbook(file);
    for await (const row of workbook.sheet('Account').rows({ blankRows: true })) {
      rows.push(row);
    }
    await workbook.close();
    expect(rows).toEqual([['Object Api Name', 'Account'], [], ['Reference Id', 'Name'], ['001', 'Acme']]);
  });

  it('JSON-stringifies object values that were not flattened', async () => {
    const file = await prepareExcelFile([{ Id: 'rec-1', Address: { city: 'Austin' } }], ['Id', 'Address']);
    const [, dataRow] = await readBackRows(file);
    expect(dataRow).toEqual(['rec-1', '{"city":"Austin"}']);
  });

  it('skips empty sheets but always writes at least one', async () => {
    const file = await prepareExcelFile({ records: [], subquery: [] });
    const workbook = await openWorkbook(file);
    expect(workbook.sheets.map(({ name }) => name)).toEqual(['Records']);
    await workbook.close();
  });

  it('sanitizes and de-duplicates sheet names', async () => {
    const file = await prepareExcelFile({ 'Bad:Name/With[Chars]': [{ a: 1 }], A_Very_Long_Custom_Object_Api_Name__c: [{ a: 1 }] });
    const workbook = await openWorkbook(file);
    expect(workbook.sheets.map(({ name }) => name)).toEqual(['Bad_Name_With_Chars_', 'A_Very_Long_Custom_Object_Api_N']);
    await workbook.close();
  });
});

describe('prepareExcelFile cell truncation', () => {
  it('truncates cells over the Excel limit to exactly EXCEL_MAX_CELL_CHARS', async () => {
    const oversized = 'x'.repeat(EXCEL_MAX_CELL_CHARS + 1000);

    const file = await prepareExcelFile([{ Id: 'rec-1', Description: oversized }], ['Id', 'Description']);

    const [, dataRow] = await readBackRows(file);
    const cell = dataRow[1] as string;
    expect(cell).toHaveLength(EXCEL_MAX_CELL_CHARS);
    expect(cell.endsWith('...(truncated)')).toBe(true);
  });

  it('passes through a cell of exactly EXCEL_MAX_CELL_CHARS untruncated', async () => {
    const atLimit = 'y'.repeat(EXCEL_MAX_CELL_CHARS);

    const file = await prepareExcelFile([{ Id: 'rec-1', Description: atLimit }], ['Id', 'Description']);

    const [, dataRow] = await readBackRows(file);
    expect(dataRow[1]).toBe(atLimit);
  });

  it('leaves non-string cells untouched', async () => {
    const file = await prepareExcelFile([{ Id: 'rec-1', Amount: 1234.5, Active: true }], ['Id', 'Amount', 'Active']);

    const [, dataRow] = await readBackRows(file);
    expect(dataRow).toEqual(['rec-1', 1234.5, true]);
  });

  it('truncates oversized cells in the multi-sheet (Record<string, any[]>) path', async () => {
    const oversized = 'z'.repeat(EXCEL_MAX_CELL_CHARS * 2);

    const file = await prepareExcelFile({ records: [{ Id: 'rec-1', Notes: oversized }] }, { records: ['Id', 'Notes'] });

    const [, dataRow] = await readBackRows(file, 'records');
    expect((dataRow[1] as string).length).toBe(EXCEL_MAX_CELL_CHARS);
  });

  it('reports the truncated cell count across every sheet so the user can be warned', async () => {
    const oversized = 'z'.repeat(EXCEL_MAX_CELL_CHARS * 2);
    const onCellsTruncated = vi.fn();

    await prepareExcelFile(
      {
        records: [
          { Id: 'rec-1', Notes: oversized },
          { Id: 'rec-2', Notes: 'short' },
        ],
        subquery: [{ Id: 'rec-3', Notes: oversized }],
      },
      { records: ['Id', 'Notes'], subquery: ['Id', 'Notes'] },
      undefined,
      { onCellsTruncated },
    );

    expect(onCellsTruncated).toHaveBeenCalledTimes(1);
    expect(onCellsTruncated).toHaveBeenCalledWith(2);
  });

  it('does not report truncation when every cell is within the limit', async () => {
    const onCellsTruncated = vi.fn();

    await prepareExcelFile([{ Id: 'rec-1', Description: 'short' }], ['Id', 'Description'], undefined, { onCellsTruncated });

    expect(onCellsTruncated).not.toHaveBeenCalled();
  });

  it('never mutates caller-owned rows', async () => {
    const untouchedRow = ['rec-1', 'short'];
    const truncatedRow = ['rec-2', 'x'.repeat(EXCEL_MAX_CELL_CHARS + 1)];
    const rows = [['Id', 'Description'], untouchedRow, truncatedRow];

    await prepareExcelFile({ records: rows });

    expect(rows[1]).toBe(untouchedRow);
    expect(truncatedRow[1]).toHaveLength(EXCEL_MAX_CELL_CHARS + 1);
  });
});

describe('formatNumber', () => {
  it('formats whole numbers with thousands separators', () => {
    expect(formatNumber(1234)).toBe('1,234');
    expect(formatNumber(1234567)).toBe('1,234,567');
  });

  it('returns "0" for zero, undefined, or NaN', () => {
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(undefined)).toBe('0');
    expect(formatNumber(NaN)).toBe('0');
  });

  it('handles small and negative numbers', () => {
    expect(formatNumber(7)).toBe('7');
    expect(formatNumber(-1234)).toBe('-1,234');
  });

  it('truncates fractional input to whole-number display (legacy behavior)', () => {
    // Previous numeral('0,0') behavior rounded; Intl.NumberFormat default also rounds for integer-only formatting.
    expect(formatNumber(1234.4)).toBe('1,234');
    expect(formatNumber(1234.6)).toBe('1,235');
  });
});
