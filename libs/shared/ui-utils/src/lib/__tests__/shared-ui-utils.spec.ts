import * as XLSX from 'xlsx';
import { EXCEL_MAX_CELL_CHARS, formatNumber, prepareExcelFile } from '../shared-ui-utils';

/** Read a generated workbook back into array-of-array rows for the first sheet */
function readBackRows(fileData: ArrayBuffer): unknown[][] {
  const workbook = XLSX.read(fileData, { type: 'array' });
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  return XLSX.utils.sheet_to_json(worksheet, { header: 1 });
}

describe('prepareExcelFile cell truncation', () => {
  it('truncates cells over the Excel limit to exactly EXCEL_MAX_CELL_CHARS so XLSX.write succeeds', () => {
    const oversized = 'x'.repeat(EXCEL_MAX_CELL_CHARS + 1000);

    // Without truncation XLSX.write throws "Text length must not exceed 32767 characters"
    const fileData = prepareExcelFile([{ Id: 'rec-1', Description: oversized }], ['Id', 'Description']);

    const [, dataRow] = readBackRows(fileData);
    const cell = dataRow[1] as string;
    expect(cell).toHaveLength(EXCEL_MAX_CELL_CHARS);
    expect(cell.endsWith('...(truncated)')).toBe(true);
  });

  it('passes through a cell of exactly EXCEL_MAX_CELL_CHARS untruncated', () => {
    const atLimit = 'y'.repeat(EXCEL_MAX_CELL_CHARS);

    const fileData = prepareExcelFile([{ Id: 'rec-1', Description: atLimit }], ['Id', 'Description']);

    const [, dataRow] = readBackRows(fileData);
    expect(dataRow[1]).toBe(atLimit);
  });

  it('leaves non-string cells untouched', () => {
    const fileData = prepareExcelFile([{ Id: 'rec-1', Amount: 1234.5, Active: true }], ['Id', 'Amount', 'Active']);

    const [, dataRow] = readBackRows(fileData);
    expect(dataRow).toEqual(['rec-1', 1234.5, true]);
  });

  it('truncates oversized cells in the multi-sheet (Record<string, any[]>) path', () => {
    const oversized = 'z'.repeat(EXCEL_MAX_CELL_CHARS * 2);

    const fileData = prepareExcelFile({ records: [{ Id: 'rec-1', Notes: oversized }] }, { records: ['Id', 'Notes'] });

    const [, dataRow] = readBackRows(fileData);
    expect((dataRow[1] as string).length).toBe(EXCEL_MAX_CELL_CHARS);
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
