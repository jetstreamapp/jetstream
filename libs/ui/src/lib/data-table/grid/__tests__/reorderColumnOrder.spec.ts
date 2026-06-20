import { describe, expect, test } from 'vitest';
import { reorderColumnOrder } from '../grid-column-utils';
import { ACTION_COLUMN_KEY, SELECT_COLUMN_KEY } from '../grid-constants';

describe('reorderColumnOrder', () => {
  const order = [ACTION_COLUMN_KEY, SELECT_COLUMN_KEY, 'Name', 'Amount', 'Stage'];

  test('moves a column to the right of a later target', () => {
    expect(reorderColumnOrder(order, 'Name', 'Stage', 'right')).toEqual([ACTION_COLUMN_KEY, SELECT_COLUMN_KEY, 'Amount', 'Stage', 'Name']);
  });

  test('moves a column to the left of a later target', () => {
    expect(reorderColumnOrder(order, 'Name', 'Stage', 'left')).toEqual([ACTION_COLUMN_KEY, SELECT_COLUMN_KEY, 'Amount', 'Name', 'Stage']);
  });

  test('moves a column to the right of an earlier target', () => {
    expect(reorderColumnOrder(order, 'Stage', 'Name', 'right')).toEqual([ACTION_COLUMN_KEY, SELECT_COLUMN_KEY, 'Name', 'Stage', 'Amount']);
  });

  test('moves a column to the left of an earlier target', () => {
    expect(reorderColumnOrder(order, 'Stage', 'Name', 'left')).toEqual([ACTION_COLUMN_KEY, SELECT_COLUMN_KEY, 'Stage', 'Name', 'Amount']);
  });

  test('returns the original reference for a no-op move (same source and target)', () => {
    expect(reorderColumnOrder(order, 'Name', 'Name', 'left')).toBe(order);
  });

  test('returns the original reference when the resulting order is unchanged', () => {
    // Dropping Name to the left of the column immediately after it is a no-op.
    expect(reorderColumnOrder(order, 'Name', 'Amount', 'left')).toBe(order);
  });

  test('returns the original reference when an id is missing', () => {
    expect(reorderColumnOrder(order, 'Missing', 'Name', 'left')).toBe(order);
    expect(reorderColumnOrder(order, 'Name', 'Missing', 'left')).toBe(order);
  });
});
