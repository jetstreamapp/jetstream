import { removeEmptyRows } from '../shared-ui-utils';

describe('removeEmptyRows', () => {
  it('should return empty data and zero removed count for an empty array', () => {
    const result = removeEmptyRows([]);
    expect(result.data).toEqual([]);
    expect(result.removedCount).toBe(0);
  });

  it('should return all rows unchanged when no rows are empty', () => {
    const data = [
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ];
    const result = removeEmptyRows(data);
    expect(result.data).toEqual(data);
    expect(result.removedCount).toBe(0);
  });

  it('should remove rows where all values are null', () => {
    const data = [
      { name: null, age: null },
      { name: 'Alice', age: 30 },
    ];
    const result = removeEmptyRows(data);
    expect(result.data).toEqual([{ name: 'Alice', age: 30 }]);
    expect(result.removedCount).toBe(1);
  });

  it('should remove rows where all values are undefined', () => {
    const data = [
      { name: undefined, age: undefined },
      { name: 'Bob', age: 25 },
    ];
    const result = removeEmptyRows(data);
    expect(result.data).toEqual([{ name: 'Bob', age: 25 }]);
    expect(result.removedCount).toBe(1);
  });

  it('should remove rows where all values are empty strings', () => {
    const data = [
      { name: '', city: '' },
      { name: 'Carol', city: 'Portland' },
    ];
    const result = removeEmptyRows(data);
    expect(result.data).toEqual([{ name: 'Carol', city: 'Portland' }]);
    expect(result.removedCount).toBe(1);
  });

  it('should remove rows where all values are whitespace-only strings', () => {
    const data = [
      { name: '   ', city: '\t' },
      { name: 'Dave', city: 'Austin' },
    ];
    const result = removeEmptyRows(data);
    expect(result.data).toEqual([{ name: 'Dave', city: 'Austin' }]);
    expect(result.removedCount).toBe(1);
  });

  it('should keep rows that have at least one non-empty value', () => {
    const data = [
      { name: 'Eve', city: '' },
      { name: '', city: '' },
    ];
    const result = removeEmptyRows(data);
    expect(result.data).toEqual([{ name: 'Eve', city: '' }]);
    expect(result.removedCount).toBe(1);
  });

  it('should keep rows where a value is 0 (not treated as empty)', () => {
    const data = [
      { count: 0, label: '' },
      { count: null, label: null },
    ];
    const result = removeEmptyRows(data);
    expect(result.data).toEqual([{ count: 0, label: '' }]);
    expect(result.removedCount).toBe(1);
  });

  it('should keep rows where a value is false (not treated as empty)', () => {
    const data = [
      { active: false, name: '' },
      { active: null, name: null },
    ];
    const result = removeEmptyRows(data);
    expect(result.data).toEqual([{ active: false, name: '' }]);
    expect(result.removedCount).toBe(1);
  });

  it('should handle mixed rows correctly and report the right removed count', () => {
    const data = [
      { name: 'Alice', age: 30 },
      { name: '', age: '' },
      { name: null, age: null },
      { name: '   ', age: '\t' },
      { name: 'Bob', age: 25 },
    ];
    const result = removeEmptyRows(data);
    expect(result.data).toEqual([
      { name: 'Alice', age: 30 },
      { name: 'Bob', age: 25 },
    ]);
    expect(result.removedCount).toBe(3);
  });

  it('should remove all rows when every row is empty and return the correct count', () => {
    const data = [
      { a: null, b: undefined },
      { a: '', b: '  ' },
    ];
    const result = removeEmptyRows(data);
    expect(result.data).toEqual([]);
    expect(result.removedCount).toBe(2);
  });

  it('should treat null/undefined/non-object entries as empty and filter them out without throwing', () => {
    const data = [null, undefined, 'string', 42, { name: 'Alice', age: 30 }];
    const result = removeEmptyRows(data as any[]);
    expect(result.data).toEqual([{ name: 'Alice', age: 30 }]);
    expect(result.removedCount).toBe(4);
  });
});
