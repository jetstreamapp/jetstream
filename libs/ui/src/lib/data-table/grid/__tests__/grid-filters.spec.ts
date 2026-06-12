import { describe, expect, test } from 'vitest';
import { EMPTY_FIELD } from '../grid-constants';
import { computeFilterSetValues, filterRecord, hasFilterApplied, isFilterActive, resetFilter } from '../grid-filters';
import { ColumnWithFilter } from '../grid-types';

describe('resetFilter', () => {
  test('produces empty defaults per type', () => {
    expect(resetFilter('TEXT')).toEqual({ type: 'TEXT', value: '' });
    expect(resetFilter('NUMBER')).toEqual({ type: 'NUMBER', value: null, comparator: 'EQUALS' });
    expect(resetFilter('DATE')).toEqual({ type: 'DATE', value: '', comparator: 'GREATER_THAN' });
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
