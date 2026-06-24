import { describe, expect, test } from 'vitest';
import { computePasteTargets, parsePastedText, PasteSelectionRect } from '../grid-paste';

function makeRow(id: string, grouped = false): any {
  return { id, original: { _key: id }, getIsGrouped: () => grouped };
}
function makeCol(id: string): any {
  return { id };
}

describe('parsePastedText', () => {
  test('treats a value with no tab/newline as a 1x1 matrix', () => {
    expect(parsePastedText('hello')).toEqual([['hello']]);
  });

  test('parses tab + newline delimited text into a matrix', () => {
    expect(parsePastedText('a\tb\nc\td')).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });

  test('drops a single trailing empty row (Excel/Sheets trailing newline)', () => {
    expect(parsePastedText('a\tb\n')).toEqual([['a', 'b']]);
  });

  test('pads ragged rows to a uniform column count', () => {
    expect(parsePastedText('a\tb\tc\nd')).toEqual([
      ['a', 'b', 'c'],
      ['d', '', ''],
    ]);
  });

  test('returns an empty matrix for empty input', () => {
    expect(parsePastedText('')).toEqual([]);
  });
});

describe('computePasteTargets', () => {
  const rows = [makeRow('r0'), makeRow('r1'), makeRow('r2')];
  const columns = [makeCol('A'), makeCol('B'), makeCol('C')];
  const allEditable = () => true;
  const getRowKey = (row: any) => row._key;

  function rect(minRow: number, maxRow: number, minCol: number, maxCol: number): PasteSelectionRect {
    return { minRow, maxRow, minCol, maxCol };
  }

  test('single value fills the entire selection', () => {
    const { cells } = computePasteTargets({
      rows,
      columns,
      selRect: rect(0, 1, 0, 1),
      matrix: [['X']],
      isColumnEditable: allEditable,
      getRowKey,
    });
    expect(cells).toHaveLength(4);
    expect(cells.every((cell) => cell.value === 'X')).toBe(true);
  });

  test('a block pastes from the anchor of a collapsed selection', () => {
    const { cells } = computePasteTargets({
      rows,
      columns,
      selRect: rect(0, 0, 0, 0),
      matrix: [
        ['a', 'b'],
        ['c', 'd'],
      ],
      isColumnEditable: allEditable,
      getRowKey,
    });
    expect(cells).toEqual([
      { rowKey: 'r0', columnKey: 'A', value: 'a' },
      { rowKey: 'r0', columnKey: 'B', value: 'b' },
      { rowKey: 'r1', columnKey: 'A', value: 'c' },
      { rowKey: 'r1', columnKey: 'B', value: 'd' },
    ]);
  });

  test('clips a block to the grid bounds (never adds rows/cols)', () => {
    const { cells } = computePasteTargets({
      rows,
      columns,
      selRect: rect(2, 2, 2, 2),
      matrix: [
        ['a', 'b'],
        ['c', 'd'],
      ],
      isColumnEditable: allEditable,
      getRowKey,
    });
    // Anchored at the last row/col, so only the top-left of the block lands.
    expect(cells).toEqual([{ rowKey: 'r2', columnKey: 'C', value: 'a' }]);
  });

  test('skips non-editable cells and counts them', () => {
    const { cells, skippedCount } = computePasteTargets({
      rows,
      columns,
      selRect: rect(0, 0, 0, 1),
      matrix: [['X']],
      isColumnEditable: (_rowId, columnId) => columnId === 'A',
      getRowKey,
    });
    expect(cells).toEqual([{ rowKey: 'r0', columnKey: 'A', value: 'X' }]);
    expect(skippedCount).toBe(1);
  });

  test('skips grouped rows silently (not counted as read-only)', () => {
    const groupedRows = [makeRow('g', true), makeRow('r1')];
    const { cells, skippedCount } = computePasteTargets({
      rows: groupedRows,
      columns,
      selRect: rect(0, 1, 0, 0),
      matrix: [['X']],
      isColumnEditable: allEditable,
      getRowKey,
    });
    expect(cells).toEqual([{ rowKey: 'r1', columnKey: 'A', value: 'X' }]);
    expect(skippedCount).toBe(0);
  });

  test('tiles a 1xN block to fill a larger selection', () => {
    const { cells } = computePasteTargets({
      rows,
      columns,
      selRect: rect(0, 1, 0, 0),
      matrix: [['Z']],
      isColumnEditable: allEditable,
      getRowKey,
    });
    expect(cells).toEqual([
      { rowKey: 'r0', columnKey: 'A', value: 'Z' },
      { rowKey: 'r1', columnKey: 'A', value: 'Z' },
    ]);
  });
});
