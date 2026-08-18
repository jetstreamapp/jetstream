import { describe, expect, test } from 'vitest';
import {
  getQueryRecordKey,
  hasIncompleteSubqueries,
  isIncompleteSubqueryResult,
  isSubqueryResult,
  mergeQueryRecordPages,
  mergeSubqueryResults,
} from '../subquery-record-utils';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeRecord(id: string, type = 'Account', extra: Record<string, unknown> = {}): Record<string, any> {
  return { Id: id, attributes: { type, url: `/services/data/v65.0/sobjects/${type}/${id}` }, ...extra };
}

function makeSubquery(
  records: unknown[],
  { done = true, nextRecordsUrl = undefined as string | undefined, totalSize = records.length } = {},
) {
  return { done, totalSize, records, ...(nextRecordsUrl ? { nextRecordsUrl } : {}) };
}

describe('isSubqueryResult', () => {
  test.each([
    ['a subquery result', makeSubquery([]), true],
    ['a plain string', 'Acme', false],
    ['null', null, false],
    ['an address compound field', { city: 'Portland', state: 'OR' }, false],
    ['an object with records but no done flag', { records: [] }, false],
  ])('%s', (_label, value, expected) => {
    expect(isSubqueryResult(value)).toBe(expected);
  });
});

describe('getQueryRecordKey', () => {
  test('prefers the record url', () => {
    expect(getQueryRecordKey(makeRecord('001A'))).toBe('/services/data/v65.0/sobjects/Account/001A');
  });

  test('falls back to the id', () => {
    expect(getQueryRecordKey({ Id: '001A' })).toBe('001A');
  });

  test('returns null when there is nothing to key on', () => {
    expect(getQueryRecordKey({ Name: 'Acme' })).toBeNull();
    expect(getQueryRecordKey(null)).toBeNull();
  });
});

describe('isIncompleteSubqueryResult', () => {
  test('is false when the result set is fully loaded', () => {
    expect(isIncompleteSubqueryResult(makeSubquery([makeRecord('003A', 'Contact')]))).toBe(false);
  });

  test('is true when the result set has its own records left to fetch', () => {
    expect(isIncompleteSubqueryResult(makeSubquery([], { done: false, nextRecordsUrl: '/next/contacts' }))).toBe(true);
  });

  test('is true when a subquery nested within its records was truncated', () => {
    const contactWithTruncatedCases = makeRecord('003A', 'Contact', {
      Cases: makeSubquery([], { done: false, nextRecordsUrl: '/next/cases' }),
    });

    expect(isIncompleteSubqueryResult(makeSubquery([contactWithTruncatedCases]))).toBe(true);
  });

  test('is false when there is no result set', () => {
    expect(isIncompleteSubqueryResult(null)).toBe(false);
    expect(isIncompleteSubqueryResult(undefined)).toBe(false);
  });
});

describe('hasIncompleteSubqueries', () => {
  test('is false when everything came back', () => {
    expect(hasIncompleteSubqueries(makeRecord('001A', 'Account', { Contacts: makeSubquery([makeRecord('003A', 'Contact')]) }))).toBe(false);
  });

  test('is true when the record itself has a truncated subquery', () => {
    const record = makeRecord('001A', 'Account', { Contacts: makeSubquery([], { done: false, nextRecordsUrl: '/next' }) });
    expect(hasIncompleteSubqueries(record)).toBe(true);
  });

  test('is true when a subquery nested several levels down was truncated', () => {
    const contactWithTruncatedCases = makeRecord('003A', 'Contact', {
      Cases: makeSubquery([], { done: false, nextRecordsUrl: '/next/cases' }),
    });
    const record = makeRecord('001A', 'Account', { Contacts: makeSubquery([contactWithTruncatedCases]) });

    expect(hasIncompleteSubqueries(record)).toBe(true);
  });

  test('is false for records without subqueries at all', () => {
    expect(hasIncompleteSubqueries(makeRecord('001A'))).toBe(false);
    expect(hasIncompleteSubqueries(null)).toBe(false);
  });
});

describe('mergeSubqueryResults', () => {
  test('appends the page and takes its paging state', () => {
    const existing = makeSubquery([makeRecord('003A', 'Contact')], { done: false, nextRecordsUrl: '/next/1', totalSize: 3 });
    const page = makeSubquery([makeRecord('003B', 'Contact'), makeRecord('003C', 'Contact')], { done: true, totalSize: 3 });

    const merged = mergeSubqueryResults(existing, page);

    expect(merged.records.map(({ Id }) => Id)).toEqual(['003A', '003B', '003C']);
    expect(merged.done).toBe(true);
    expect(merged.nextRecordsUrl).toBeUndefined();
    expect(merged.totalSize).toBe(3);
  });

  test('skips records already loaded so an overlapping page cannot duplicate rows', () => {
    const existing = makeSubquery([makeRecord('003A', 'Contact'), makeRecord('003B', 'Contact')], { done: false, nextRecordsUrl: '/next' });
    const page = makeSubquery([makeRecord('003B', 'Contact'), makeRecord('003C', 'Contact')]);

    expect(mergeSubqueryResults(existing, page).records.map(({ Id }) => Id)).toEqual(['003A', '003B', '003C']);
  });

  test('keeps records that have no id to compare on', () => {
    const existing = makeSubquery([{ Amount: 1 }], { done: false, nextRecordsUrl: '/next' });
    const page = makeSubquery([{ Amount: 2 }]);

    expect(mergeSubqueryResults(existing, page).records).toHaveLength(2);
  });

  test('folds a repeated child record into the loaded copy rather than dropping its nested subquery records', () => {
    const existing = makeSubquery(
      [
        makeRecord('003A', 'Contact', {
          Cases: makeSubquery([makeRecord('500A', 'Case')], { done: false, nextRecordsUrl: '/next/cases' }),
        }),
      ],
      { done: false, nextRecordsUrl: '/next/contacts' },
    );
    // The same contact comes back on the next page carrying its next batch of cases
    const page = makeSubquery([makeRecord('003A', 'Contact', { Cases: makeSubquery([makeRecord('500B', 'Case')]) })]);

    const merged = mergeSubqueryResults(existing, page);

    expect(merged.records).toHaveLength(1);
    expect(merged.records[0].Cases.records.map(({ Id }: { Id: string }) => Id)).toEqual(['500A', '500B']);
    expect(merged.records[0].Cases.done).toBe(true);
  });
});

describe('mergeQueryRecordPages', () => {
  test('appends records that have not been seen', () => {
    const merged = mergeQueryRecordPages([makeRecord('001A')], [makeRecord('001B'), makeRecord('001C')]);

    expect(merged.map(({ Id }) => Id)).toEqual(['001A', '001B', '001C']);
  });

  test('folds a repeated parent into the loaded copy instead of adding a second row', () => {
    const loaded = [
      makeRecord('001A', 'Account', {
        Contacts: makeSubquery([makeRecord('003A', 'Contact')], { done: false, nextRecordsUrl: '/next/1', totalSize: 3 }),
      }),
    ];
    // Child rows count toward the batch size, so the same account comes back carrying its next batch of contacts
    const nextPage = [
      makeRecord('001A', 'Account', {
        Contacts: makeSubquery([makeRecord('003B', 'Contact'), makeRecord('003C', 'Contact')], { done: true, totalSize: 3 }),
      }),
    ];

    const merged = mergeQueryRecordPages(loaded, nextPage);

    expect(merged).toHaveLength(1);
    expect(merged[0].Contacts.records.map(({ Id }: { Id: string }) => Id)).toEqual(['003A', '003B', '003C']);
    expect(merged[0].Contacts.done).toBe(true);
  });

  test('does not mutate the records it was given', () => {
    const loaded = [makeRecord('001A', 'Account', { Contacts: makeSubquery([makeRecord('003A', 'Contact')], { done: false }) })];
    const nextPage = [makeRecord('001A', 'Account', { Contacts: makeSubquery([makeRecord('003B', 'Contact')]) })];

    mergeQueryRecordPages(loaded, nextPage);

    expect(loaded[0].Contacts.records.map(({ Id }: { Id: string }) => Id)).toEqual(['003A']);
    expect(loaded).toHaveLength(1);
  });

  test('appends records with no usable key rather than dropping them', () => {
    const merged = mergeQueryRecordPages([{ Total: 1 }], [{ Total: 2 }]);

    expect(merged).toHaveLength(2);
  });
});
