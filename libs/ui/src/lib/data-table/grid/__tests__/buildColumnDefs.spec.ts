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

  test('falls back to a positional id when a column key is missing (TanStack throws on a falsy id)', () => {
    // `key` is typed as string, but malformed columns can reach here from `any` query-result data.
    const malformed = [
      { key: undefined as unknown as string, name: 'Broken' },
      { key: '', name: 'Empty' },
    ];
    const defs = buildColumnDefs(malformed as ColumnWithFilter<Row>[]);
    expect(defs[0].id).toBe('__jgrid_col_0');
    expect(defs[1].id).toBe('__jgrid_col_1');
    defs.forEach((def) => expect(typeof def.id).toBe('string'));
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

  test('accessor indexes by the normalized id; a malformed key reads the fallback id, not row["undefined"]', () => {
    const malformed = [
      { key: 'Name', name: 'Name' },
      { key: undefined as unknown as string, name: 'Broken' },
    ];
    const defs = buildColumnDefs(malformed as ColumnWithFilter<Row>[]);
    const accessorOf = (def: (typeof defs)[number]) => (def as unknown as { accessorFn: (row: unknown) => unknown }).accessorFn;
    // `undefined`/`''` props would be picked up if the accessor still indexed by a falsy raw key.
    const row = { Name: 'Alpha', undefined: 'LEAK', '': 'LEAK' };
    expect(accessorOf(defs[0])(row)).toBe('Alpha');
    expect(accessorOf(defs[1])(row)).toBeUndefined();
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
