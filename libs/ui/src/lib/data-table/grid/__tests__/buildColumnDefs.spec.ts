import { describe, expect, test } from 'vitest';
import { buildColumnDefs } from '../buildColumnDefs';
import { ACTION_COLUMN_KEY, DEFAULT_COLUMN_WIDTH, SELECT_COLUMN_KEY } from '../grid-constants';
import { ColumnWithFilter, JetstreamColumnMeta } from '../grid-types';

interface Row {
  _key: string;
  Name: string;
  Amount: number;
}

function metaOf(def: { meta?: { jetstream?: JetstreamColumnMeta<Row> } }) {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  return def.meta!.jetstream!;
}

describe('buildColumnDefs', () => {
  const columns: ColumnWithFilter<Row>[] = [
    { key: ACTION_COLUMN_KEY, name: '', frozen: true, width: 116 },
    { key: SELECT_COLUMN_KEY, name: '', resizable: false },
    { key: 'Name', name: 'Name', sortable: true, resizable: true, filters: ['TEXT', 'SET'], width: 250 },
    { key: 'Amount', name: 'Amount', sortable: true, filters: ['NUMBER'] },
  ];

  test('maps keys to ids and preserves order', () => {
    const defs = buildColumnDefs(columns);
    expect(defs.map((def) => def.id)).toEqual([ACTION_COLUMN_KEY, SELECT_COLUMN_KEY, 'Name', 'Amount']);
  });

  test('classifies cellKind for select/action/data columns', () => {
    const defs = buildColumnDefs(columns);
    expect(metaOf(defs[0]).cellKind).toBe('action');
    expect(metaOf(defs[1]).cellKind).toBe('select');
    expect(metaOf(defs[2]).cellKind).toBe('data');
  });

  test('data columns get an accessor; non-data columns do not', () => {
    const defs = buildColumnDefs(columns);
    // accessorFn present only on data columns
    expect('accessorFn' in defs[0]).toBe(false);
    expect('accessorFn' in defs[1]).toBe(false);
    expect('accessorFn' in defs[2]).toBe(true);
  });

  test('sizing maps width/min/max; string/absent width falls back to default', () => {
    const defs = buildColumnDefs(columns);
    expect(defs[2].size).toBe(250);
    expect(defs[3].size).toBe(DEFAULT_COLUMN_WIDTH);
  });

  test('sorting/filtering enabled per column; disabled on non-data columns', () => {
    const defs = buildColumnDefs(columns);
    expect(defs[0].enableSorting).toBe(false);
    expect(defs[2].enableSorting).toBe(true);
    expect(defs[2].enableColumnFilter).toBe(true);
    expect(defs[1].enableColumnFilter).toBe(false);
  });

  test('carries the original column on meta for the presentational layer', () => {
    const defs = buildColumnDefs(columns);
    expect(metaOf(defs[2]).column.key).toBe('Name');
    expect(metaOf(defs[0]).frozen).toBe(true);
  });

  test('defaultColumnOptions fill gaps', () => {
    const defs = buildColumnDefs(columns, { resizable: true, sortable: true });
    // Amount column did not set resizable; default applies
    expect(defs[3].enableResizing).toBe(true);
  });
});
