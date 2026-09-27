import * as XLSX from 'xlsx';
import {
  EXCEL_MAX_CELL_CHARS,
  focusNextTabbableAfter,
  focusPreviousTabbableBefore,
  formatNumber,
  prepareExcelFile,
} from '../shared-ui-utils';

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

  it('reports the truncated cell count across every sheet so the user can be warned', () => {
    const oversized = 'z'.repeat(EXCEL_MAX_CELL_CHARS * 2);
    const onCellsTruncated = vi.fn();

    prepareExcelFile(
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

  it('does not report truncation when every cell is within the limit', () => {
    const onCellsTruncated = vi.fn();

    prepareExcelFile([{ Id: 'rec-1', Description: 'short' }], ['Id', 'Description'], undefined, { onCellsTruncated });

    expect(onCellsTruncated).not.toHaveBeenCalled();
  });

  it('leaves rows without an oversized cell as the same array instance', () => {
    const untouchedRow = ['rec-1', 'short'];
    const truncatedRow = ['rec-2', 'x'.repeat(EXCEL_MAX_CELL_CHARS + 1)];
    const rows = [['Id', 'Description'], untouchedRow, truncatedRow];

    // Array-of-array sheets are caller-owned, so they must never be mutated in place
    prepareExcelFile({ records: rows });

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

describe('focusNextTabbableAfter', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  function setup(html: string) {
    document.body.innerHTML = html;
    return document.getElementById('editor') as HTMLElement;
  }

  it('moves focus to the first tabbable element after the widget', () => {
    const editor = setup(`
      <div id="editor"><button id="inside">inside</button></div>
      <button id="after">after</button>
    `);

    expect(focusNextTabbableAfter(editor)).toBe(true);
    expect(document.activeElement?.id).toBe('after');
  });

  it('skips tabbables inside the widget so a code editor cannot trap focus in itself', () => {
    const editor = setup(`
      <button id="before">before</button>
      <div id="editor"><textarea id="inside"></textarea></div>
      <a id="after" href="#x">after</a>
    `);

    focusNextTabbableAfter(editor);
    expect(document.activeElement?.id).toBe('after');
  });

  it('ignores disabled and tabindex=-1 candidates', () => {
    const editor = setup(`
      <div id="editor"></div>
      <button id="disabled" disabled>nope</button>
      <div id="programmatic" tabindex="-1">nope</div>
      <button id="after">after</button>
    `);

    focusNextTabbableAfter(editor);
    expect(document.activeElement?.id).toBe('after');
  });

  it('reports when there is nothing after it rather than dropping focus to the body', () => {
    const editor = setup(`
      <button id="before">before</button>
      <div id="editor"></div>
    `);
    const before = document.getElementById('before') as HTMLElement;
    before.focus();

    expect(focusNextTabbableAfter(editor)).toBe(false);
    expect(document.activeElement).toBe(before);
  });

  it('is a no-op without an element', () => {
    expect(focusNextTabbableAfter(null)).toBe(false);
  });
});

describe('focusPreviousTabbableBefore', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('moves focus to the NEAREST tabbable before the widget, not the first on the page', () => {
    document.body.innerHTML = `
      <button id="far">far</button>
      <button id="near">near</button>
      <div id="editor"><textarea id="inside"></textarea></div>
      <button id="after">after</button>
    `;

    expect(focusPreviousTabbableBefore(document.getElementById('editor'))).toBe(true);
    expect(document.activeElement?.id).toBe('near');
  });

  it('skips tabbables inside the widget', () => {
    document.body.innerHTML = `
      <button id="before">before</button>
      <div id="editor"><button id="inside">inside</button></div>
    `;

    focusPreviousTabbableBefore(document.getElementById('editor'));
    expect(document.activeElement?.id).toBe('before');
  });

  it('reports when there is nothing before it', () => {
    document.body.innerHTML = `<div id="editor"></div><button id="after">after</button>`;
    expect(focusPreviousTabbableBefore(document.getElementById('editor'))).toBe(false);
  });
});
