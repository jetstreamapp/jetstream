import { describe, expect, test } from 'vitest';
import { EMPTY_FIELD } from '../grid-constants';
import { computeFilterSetValues, filterRecord, hasFilterApplied, isFilterActive, resetFilter } from '../grid-filters';
import { ColumnWithFilter } from '../grid-types';

describe('resetFilter', () => {
  test('produces empty defaults per type', () => {
    expect(resetFilter('TEXT')).toEqual({ type: 'TEXT', value: '' });
    expect(resetFilter('NUMBER')).toEqual({ type: 'NUMBER', value: null, comparator: 'EQUALS' });
    expect(resetFilter('DATE')).toEqual({ type: 'DATE', value: '', comparator: 'GREATER_THAN', ignoreTimestamp: false });
    expect(resetFilter('TIME')).toEqual({ type: 'TIME', value: '', comparator: 'GREATER_THAN' });
    expect(resetFilter('SET', ['a', 'b'])).toEqual({ type: 'SET', value: ['a', 'b'] });
    expect(resetFilter('BOOLEAN_SET', ['True', 'False'])).toEqual({ type: 'BOOLEAN_SET', value: ['True', 'False'] });
  });
});

describe('isFilterActive', () => {
  test('TEXT active only when non-empty', () => {
    expect(isFilterActive({ type: 'TEXT', value: '' }, 0)).toBe(false);
    expect(isFilterActive({ type: 'TEXT', value: 'x' }, 0)).toBe(true);
  });
  test('SET active when fewer than total selected', () => {
    expect(isFilterActive({ type: 'SET', value: ['a', 'b'] }, 2)).toBe(false);
    expect(isFilterActive({ type: 'SET', value: ['a'] }, 2)).toBe(true);
  });
  test('BOOLEAN_SET active unless both selected', () => {
    expect(isFilterActive({ type: 'BOOLEAN_SET', value: ['True', 'False'] }, 2)).toBe(false);
    expect(isFilterActive({ type: 'BOOLEAN_SET', value: ['True'] }, 2)).toBe(true);
  });
});

describe('filterRecord', () => {
  test('TEXT does case-insensitive contains', () => {
    expect(filterRecord({ type: 'TEXT', value: 'lph' }, 'Alpha')).toBe(true);
    expect(filterRecord({ type: 'TEXT', value: 'zzz' }, 'Alpha')).toBe(false);
    expect(filterRecord({ type: 'TEXT', value: '42' }, 42)).toBe(true);
  });
  test('NUMBER honors comparator', () => {
    expect(filterRecord({ type: 'NUMBER', value: '5', comparator: 'GREATER_THAN' }, 6)).toBe(true);
    expect(filterRecord({ type: 'NUMBER', value: '5', comparator: 'LESS_THAN' }, 4)).toBe(true);
    expect(filterRecord({ type: 'NUMBER', value: '5', comparator: 'EQUALS' }, 5)).toBe(true);
    expect(filterRecord({ type: 'NUMBER', value: '5', comparator: 'EQUALS' }, 6)).toBe(false);
    expect(filterRecord({ type: 'NUMBER', value: '5', comparator: 'EQUALS' }, 'not-a-number')).toBe(false);
  });
  describe('DATE', () => {
    // Cells render dates as `yyyy-MM-dd h:mm:ss a`. `h` is a 1-2 digit hour, so the formatted string is
    // 21 characters at 1-9 o'clock and 22 at 10/11/12 — the length the parser used to branch on.
    const singleDigitHour = '2026-08-16 9:30:00 AM';
    const doubleDigitHours = ['2026-08-16 10:30:00 AM', '2026-08-16 11:05:00 AM', '2026-08-16 12:00:00 PM', '2026-08-16 12:00:00 AM'];

    test('regression: two-digit-hour timestamps are not dropped', () => {
      // Every one of these parsed to Invalid Date and failed every comparison, silently removing the row.
      doubleDigitHours.forEach((value) => {
        expect(filterRecord({ type: 'DATE', value: '2026-08-15', comparator: 'GREATER_THAN' }, value)).toBe(true);
        expect(filterRecord({ type: 'DATE', value: '2026-08-16', comparator: 'EQUALS' }, value)).toBe(true);
        expect(filterRecord({ type: 'DATE', value: '2026-08-17', comparator: 'LESS_THAN' }, value)).toBe(true);
      });
    });

    test('single-digit-hour timestamps keep working', () => {
      expect(filterRecord({ type: 'DATE', value: '2026-08-15', comparator: 'GREATER_THAN' }, singleDigitHour)).toBe(true);
      expect(filterRecord({ type: 'DATE', value: '2026-08-16', comparator: 'EQUALS' }, singleDigitHour)).toBe(true);
      expect(filterRecord({ type: 'DATE', value: '2026-08-17', comparator: 'LESS_THAN' }, singleDigitHour)).toBe(true);
    });

    test('non-formatted values fall back to ISO parsing', () => {
      expect(filterRecord({ type: 'DATE', value: '2026-08-15', comparator: 'GREATER_THAN' }, '2026-08-16')).toBe(true);
      expect(filterRecord({ type: 'DATE', value: '2026-08-16', comparator: 'EQUALS' }, '2026-08-16')).toBe(true);
    });

    test('unparseable values and empty filters do not match', () => {
      expect(filterRecord({ type: 'DATE', value: '2026-08-16', comparator: 'EQUALS' }, 'not-a-date')).toBe(false);
      expect(filterRecord({ type: 'DATE', value: null, comparator: 'EQUALS' }, singleDigitHour)).toBe(false);
      expect(filterRecord({ type: 'DATE', value: '2026-08-16', comparator: 'EQUALS' }, '')).toBe(false);
    });

    test('GREATER_THAN_OR_EQUAL / LESS_THAN_OR_EQUAL include the filter date itself', () => {
      const sameDay = { type: 'DATE', value: '2026-08-16' } as const;
      expect(filterRecord({ ...sameDay, comparator: 'GREATER_THAN_OR_EQUAL' }, '2026-08-16 10:30:00 AM')).toBe(true);
      expect(filterRecord({ ...sameDay, comparator: 'LESS_THAN_OR_EQUAL' }, '2026-08-16 10:30:00 AM')).toBe(true);
      expect(filterRecord({ ...sameDay, comparator: 'GREATER_THAN_OR_EQUAL' }, '2026-08-15 10:30:00 AM')).toBe(false);
      expect(filterRecord({ ...sameDay, comparator: 'LESS_THAN_OR_EQUAL' }, '2026-08-17 10:30:00 AM')).toBe(false);
    });

    test('ignoreTimestamp compares calendar days only', () => {
      const filter = { type: 'DATE', value: '2026-08-16', comparator: 'GREATER_THAN' } as const;
      // Without it, a later time on the filter date still counts as "after" the start of that day.
      expect(filterRecord({ ...filter }, '2026-08-16 10:30:00 AM')).toBe(true);
      expect(filterRecord({ ...filter, ignoreTimestamp: true }, '2026-08-16 10:30:00 AM')).toBe(false);
      expect(filterRecord({ ...filter, ignoreTimestamp: true }, '2026-08-17 10:30:00 AM')).toBe(true);
    });
  });

  test('NUMBER supports inclusive comparators', () => {
    expect(filterRecord({ type: 'NUMBER', value: '5', comparator: 'GREATER_THAN_OR_EQUAL' }, 5)).toBe(true);
    expect(filterRecord({ type: 'NUMBER', value: '5', comparator: 'GREATER_THAN_OR_EQUAL' }, 4)).toBe(false);
    expect(filterRecord({ type: 'NUMBER', value: '5', comparator: 'LESS_THAN_OR_EQUAL' }, 5)).toBe(true);
    expect(filterRecord({ type: 'NUMBER', value: '5', comparator: 'LESS_THAN_OR_EQUAL' }, 6)).toBe(false);
  });

  test('TIME supports inclusive comparators', () => {
    const filter = { type: 'TIME', value: '13:30:00.0000' } as const;
    expect(filterRecord({ ...filter, comparator: 'GREATER_THAN_OR_EQUAL' }, '1:30:00 PM')).toBe(true);
    expect(filterRecord({ ...filter, comparator: 'LESS_THAN_OR_EQUAL' }, '1:30:00 PM')).toBe(true);
    expect(filterRecord({ ...filter, comparator: 'GREATER_THAN' }, '1:30:00 PM')).toBe(false);
    expect(filterRecord({ ...filter, comparator: 'GREATER_THAN_OR_EQUAL' }, '2:30:00 PM')).toBe(true);
    expect(filterRecord({ ...filter, comparator: 'LESS_THAN_OR_EQUAL' }, '2:30:00 PM')).toBe(false);
  });

  test('TIME EQUALS compares the time of day, not the reference day', () => {
    const filter = { type: 'TIME', value: '13:30:00.0000', comparator: 'EQUALS' } as const;
    expect(filterRecord(filter, '1:30:00 PM')).toBe(true);
    expect(filterRecord(filter, '2:30:00 PM')).toBe(false);
    expect(filterRecord(filter, '1:31:00 PM')).toBe(false);
  });

  test('SET matches selected values and EMPTY_FIELD matches null', () => {
    expect(filterRecord({ type: 'SET', value: ['Alpha', 'Bravo'] }, 'Alpha')).toBe(true);
    expect(filterRecord({ type: 'SET', value: ['Alpha'] }, 'Bravo')).toBe(false);
    expect(filterRecord({ type: 'SET', value: [EMPTY_FIELD] }, null)).toBe(true);
    expect(filterRecord({ type: 'SET', value: ['Alpha'] }, null)).toBe(false);
  });
  test('BOOLEAN_SET both selected always matches; single selection compares', () => {
    expect(filterRecord({ type: 'BOOLEAN_SET', value: ['True', 'False'] }, true)).toBe(true);
    expect(filterRecord({ type: 'BOOLEAN_SET', value: ['True'] }, true)).toBe(true);
    expect(filterRecord({ type: 'BOOLEAN_SET', value: ['True'] }, false)).toBe(false);
    expect(filterRecord({ type: 'BOOLEAN_SET', value: [] }, true)).toBe(false);
  });
});

describe('computeFilterSetValues', () => {
  interface Row {
    _key: string;
    Name: string;
    Active: boolean;
  }
  const data: Row[] = [
    { _key: '1', Name: 'Alpha', Active: true },
    { _key: '2', Name: 'Bravo', Active: false },
    { _key: '3', Name: 'Alpha', Active: true },
  ];
  const columns: ColumnWithFilter<Row>[] = [
    { key: 'Name', name: 'Name', filters: ['TEXT', 'SET'] },
    { key: 'Active', name: 'Active', filters: ['BOOLEAN_SET'] },
    { key: 'NoFilter', name: 'NoFilter' },
  ];

  test('distinct SET values + boolean fixed values, skipping unfiltered columns', () => {
    const result = computeFilterSetValues(columns, data);
    expect(result['Name'].sort()).toEqual(['Alpha', 'Bravo']);
    expect(result['Active']).toEqual(['True', 'False']);
    expect(result['NoFilter']).toBeUndefined();
  });

  test('traverses getSubRows trees — values on child rows are collected, ignored parents are skipped', () => {
    // Automation Control shape: top-level rows are category headers (excluded from the SET list via
    // ignoreRowInSetFilter); the filterable values live on their children (and grandchildren).
    interface TreeRow extends Row {
      isCategory?: boolean;
      children?: TreeRow[];
    }
    const tree: TreeRow[] = [
      {
        _key: 'cat-1',
        Name: 'Apex Trigger',
        Active: true,
        isCategory: true,
        children: [
          { _key: 'i-1', Name: 'AccountTrigger', Active: true, children: [{ _key: 'i-1-v1', Name: 'AccountTriggerV1', Active: true }] },
          { _key: 'i-2', Name: 'ContactTrigger', Active: false },
        ],
      },
      { _key: 'cat-2', Name: 'Validation Rule', Active: true, isCategory: true, children: [] },
    ];
    const result = computeFilterSetValues(
      columns as unknown as ColumnWithFilter<TreeRow>[],
      tree,
      (row) => !!row.isCategory,
      (row) => row.children,
    );
    expect(result['Name'].sort()).toEqual(['AccountTrigger', 'AccountTriggerV1', 'ContactTrigger']);
  });

  test('null values collapse to EMPTY_FIELD and ignoreRowInSetFilter excludes rows', () => {
    const withNull: Row[] = [...data, { _key: '4', Name: null as unknown as string, Active: true }];
    const result = computeFilterSetValues(columns, withNull, (row) => row._key === '4');
    expect(result['Name']).not.toContain(EMPTY_FIELD);
    const resultIncluding = computeFilterSetValues(columns, withNull);
    expect(resultIncluding['Name']).toContain(EMPTY_FIELD);
  });
});

describe('hasFilterApplied', () => {
  test('true only when a filter narrows results', () => {
    const filterSetValues = { Name: ['Alpha', 'Bravo'] };
    expect(hasFilterApplied({ Name: [{ type: 'SET', value: ['Alpha', 'Bravo'] }] }, filterSetValues)).toBe(false);
    expect(hasFilterApplied({ Name: [{ type: 'SET', value: ['Alpha'] }] }, filterSetValues)).toBe(true);
    expect(hasFilterApplied({ Name: [{ type: 'TEXT', value: '' }] }, filterSetValues)).toBe(false);
    expect(hasFilterApplied({ Name: [{ type: 'TEXT', value: 'x' }] }, filterSetValues)).toBe(true);
  });
});
