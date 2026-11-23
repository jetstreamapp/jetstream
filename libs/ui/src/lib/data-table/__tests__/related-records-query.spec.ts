import { Field } from '@jetstream/types';
import { describe, expect, it } from 'vitest';
import { ColumnWithFilter } from '../data-table-types';
import { MAX_RELATED_RECORD_IDS, getRelatedRecordsMenuItem, getRelatedRecordsQueryTarget } from '../related-records-query';

type Row = Record<string, unknown>;

function buildColumn(field?: Partial<Field>): ColumnWithFilter<Row, unknown> {
  return { key: 'AccountId', name: 'AccountId', meta: field ? { field } : undefined } as ColumnWithFilter<Row, unknown>;
}

const LOOKUP_FIELD: Partial<Field> = { type: 'reference', referenceTo: ['Account'] };

function buildId(index: number) {
  return `001${String(index).padStart(15, '0')}`;
}

describe('getRelatedRecordsQueryTarget', () => {
  it('collects the distinct ids from a lookup column', () => {
    const rows: Row[] = [{ AccountId: buildId(1) }, { AccountId: buildId(2) }, { AccountId: buildId(1) }];
    expect(getRelatedRecordsQueryTarget(buildColumn(LOOKUP_FIELD), rows)).toEqual({
      sobject: 'Account',
      recordIds: [buildId(1), buildId(2)],
      totalIdCount: 2,
    });
  });

  it('skips empty and non-id values', () => {
    const rows: Row[] = [
      { AccountId: null },
      { AccountId: '' },
      { AccountId: 'not an id' },
      { AccountId: 42 },
      {},
      { AccountId: buildId(1) },
    ];
    expect(getRelatedRecordsQueryTarget(buildColumn(LOOKUP_FIELD), rows)?.recordIds).toEqual([buildId(1)]);
  });

  it('caps the ids and reports how many there were', () => {
    const rows: Row[] = Array.from({ length: MAX_RELATED_RECORD_IDS + 25 }, (_, i) => ({ AccountId: buildId(i) }));
    const target = getRelatedRecordsQueryTarget(buildColumn(LOOKUP_FIELD), rows);
    expect(target?.recordIds).toHaveLength(MAX_RELATED_RECORD_IDS);
    expect(target?.recordIds[0]).toBe(buildId(0));
    expect(target?.totalIdCount).toBe(MAX_RELATED_RECORD_IDS + 25);
  });

  it('returns null when the column has no field describe', () => {
    expect(getRelatedRecordsQueryTarget(buildColumn(), [{ AccountId: buildId(1) }])).toBeNull();
  });

  it('returns null for a column that is not a lookup', () => {
    expect(getRelatedRecordsQueryTarget(buildColumn({ type: 'string', referenceTo: [] }), [{ AccountId: buildId(1) }])).toBeNull();
  });

  it('returns null for a polymorphic lookup', () => {
    const column = buildColumn({ type: 'reference', referenceTo: ['User', 'Group'] });
    expect(getRelatedRecordsQueryTarget(column, [{ AccountId: buildId(1) }])).toBeNull();
  });
});

describe('getRelatedRecordsMenuItem', () => {
  it('labels the item with the record count and object', () => {
    const item = getRelatedRecordsMenuItem({ sobject: 'Account', recordIds: [buildId(1), buildId(2)], totalIdCount: 2 });
    expect(item.label).toBe('Query 2 related Account records');
    expect(item.value).toBe('QUERY_RELATED_RECORDS');
    expect(item.disabled).toBe(false);
  });

  it('uses the singular for one record', () => {
    expect(getRelatedRecordsMenuItem({ sobject: 'Account', recordIds: [buildId(1)], totalIdCount: 1 }).label).toBe(
      'Query 1 related Account record',
    );
  });

  it('says when the ids were capped', () => {
    const recordIds = Array.from({ length: MAX_RELATED_RECORD_IDS }, (_, i) => buildId(i));
    expect(getRelatedRecordsMenuItem({ sobject: 'Account', recordIds, totalIdCount: 1234 }).label).toBe(
      'Query first 500 of 1,234 related Account records',
    );
  });

  it('is disabled when the column has no ids', () => {
    expect(getRelatedRecordsMenuItem({ sobject: 'Account', recordIds: [], totalIdCount: 0 }).disabled).toBe(true);
  });
});
