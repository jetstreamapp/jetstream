import { ApiHistoryItem, LoadSavedMappingItem, QueryHistoryItem, RecentHistoryItem } from '@jetstream/types';
import { describe, expect, it } from 'vitest';
import {
  mergeApiRequestHistory,
  mergeLoadSavedMapping,
  mergeQueryHistory,
  mergeRecentHistoryItem,
  toQueryHistoryObject,
} from '../client-data-merge.utils';

function queryHistory(overrides: Partial<QueryHistoryItem> = {}): QueryHistoryItem {
  return {
    key: 'qh_o:accountselectid',
    hashedKey: 'h',
    org: 'o',
    sObject: 'Account',
    label: 'Account',
    soql: 'SELECT Id FROM Account',
    runCount: 1,
    isTooling: false,
    isFavorite: false,
    lastRun: new Date('2026-01-01T00:00:00Z'),
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  };
}

describe('mergeQueryHistory', () => {
  it('returns a clone of the imported record when nothing exists', () => {
    const imported = queryHistory();
    const merged = mergeQueryHistory(undefined, imported);
    expect(merged).toEqual(imported);
    expect(merged).not.toBe(imported);
  });

  it('is idempotent — re-importing an identical record does not inflate run count or flip favorite', () => {
    const existing = queryHistory({ runCount: 5, isFavorite: true });
    const merged = mergeQueryHistory(existing, { ...existing });
    expect(merged.runCount).toBe(5);
    expect(merged.isFavorite).toBe(true);
    expect(merged.lastRun).toEqual(existing.lastRun);
  });

  it('keeps the max run count', () => {
    expect(mergeQueryHistory(queryHistory({ runCount: 5 }), queryHistory({ runCount: 3 })).runCount).toBe(5);
    expect(mergeQueryHistory(queryHistory({ runCount: 2 }), queryHistory({ runCount: 7 })).runCount).toBe(7);
  });

  it('unions the favorite flag (favorite if either is)', () => {
    expect(mergeQueryHistory(queryHistory({ isFavorite: false }), queryHistory({ isFavorite: true })).isFavorite).toBe(true);
    expect(mergeQueryHistory(queryHistory({ isFavorite: true }), queryHistory({ isFavorite: false })).isFavorite).toBe(true);
    expect(mergeQueryHistory(queryHistory({ isFavorite: false }), queryHistory({ isFavorite: false })).isFavorite).toBe(false);
  });

  it('takes content fields from the most-recently-run record and keeps the latest lastRun', () => {
    const existing = queryHistory({ soql: 'OLD', lastRun: new Date('2026-01-01T00:00:00Z') });
    const imported = queryHistory({ soql: 'NEW', lastRun: new Date('2026-02-01T00:00:00Z') });

    const importedWins = mergeQueryHistory(existing, imported);
    expect(importedWins.soql).toBe('NEW');
    expect(importedWins.lastRun).toEqual(new Date('2026-02-01T00:00:00Z'));

    const existingWins = mergeQueryHistory(imported, existing);
    expect(existingWins.soql).toBe('NEW');
    expect(existingWins.lastRun).toEqual(new Date('2026-02-01T00:00:00Z'));
  });

  it('keeps the earliest createdAt', () => {
    const merged = mergeQueryHistory(
      queryHistory({ createdAt: new Date('2026-03-01T00:00:00Z') }),
      queryHistory({ createdAt: new Date('2026-01-01T00:00:00Z') }),
    );
    expect(merged.createdAt).toEqual(new Date('2026-01-01T00:00:00Z'));
  });
});

describe('mergeApiRequestHistory', () => {
  function apiHistory(overrides: Partial<ApiHistoryItem> = {}): ApiHistoryItem {
    return {
      key: 'api_o:get:/services/data',
      hashedKey: 'h',
      org: 'o',
      label: '/services/data',
      lastRun: new Date('2026-01-01T00:00:00Z'),
      isFavorite: 'false',
      request: { method: 'GET', url: '/services/data', headers: {}, body: '', bodyType: 'JSON' },
      response: { status: 200, statusText: 'OK' },
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      ...overrides,
    };
  }

  it('unions the string favorite flag', () => {
    expect(mergeApiRequestHistory(apiHistory({ isFavorite: 'true' }), apiHistory({ isFavorite: 'false' })).isFavorite).toBe('true');
    expect(mergeApiRequestHistory(apiHistory({ isFavorite: 'false' }), apiHistory({ isFavorite: 'false' })).isFavorite).toBe('false');
  });

  it('keeps the latest lastRun and earliest createdAt', () => {
    const merged = mergeApiRequestHistory(
      apiHistory({ lastRun: new Date('2026-01-01T00:00:00Z'), createdAt: new Date('2026-02-01T00:00:00Z') }),
      apiHistory({ lastRun: new Date('2026-03-01T00:00:00Z'), createdAt: new Date('2026-01-01T00:00:00Z') }),
    );
    expect(merged.lastRun).toEqual(new Date('2026-03-01T00:00:00Z'));
    expect(merged.createdAt).toEqual(new Date('2026-01-01T00:00:00Z'));
  });
});

describe('mergeLoadSavedMapping', () => {
  function mapping(overrides: Partial<LoadSavedMappingItem> = {}): LoadSavedMappingItem {
    return {
      key: 'lsm_account:3:123',
      hashedKey: 'h',
      name: 'My Mapping',
      sobject: 'Account',
      csvFields: ['a'],
      sobjectFields: ['Name'],
      mapping: {},
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      ...overrides,
    };
  }

  it('keeps the record with the later updatedAt and the earliest createdAt', () => {
    const merged = mergeLoadSavedMapping(
      mapping({ name: 'OLD', updatedAt: new Date('2026-01-01T00:00:00Z'), createdAt: new Date('2026-02-01T00:00:00Z') }),
      mapping({ name: 'NEW', updatedAt: new Date('2026-03-01T00:00:00Z'), createdAt: new Date('2026-01-01T00:00:00Z') }),
    );
    expect(merged.name).toBe('NEW');
    expect(merged.updatedAt).toEqual(new Date('2026-03-01T00:00:00Z'));
    expect(merged.createdAt).toEqual(new Date('2026-01-01T00:00:00Z'));
  });
});

describe('mergeRecentHistoryItem', () => {
  function recent(overrides: Partial<RecentHistoryItem> = {}): RecentHistoryItem {
    return {
      key: 'ri_o:sobject',
      hashedKey: 'h',
      org: 'o',
      items: [],
      createdAt: new Date('2026-01-01T00:00:00Z'),
      updatedAt: new Date('2026-01-01T00:00:00Z'),
      ...overrides,
    };
  }

  it('unions items by name, keeping the most-recently-used entry', () => {
    const existing = recent({
      items: [
        { name: 'Account', lastUsed: new Date('2026-01-01T00:00:00Z') },
        { name: 'Contact', lastUsed: new Date('2026-01-02T00:00:00Z') },
      ],
    });
    const imported = recent({
      items: [
        { name: 'Account', lastUsed: new Date('2026-03-01T00:00:00Z') },
        { name: 'Lead', lastUsed: new Date('2026-02-01T00:00:00Z') },
      ],
    });

    const merged = mergeRecentHistoryItem(existing, imported);

    expect(merged.items.map(({ name }) => name).sort()).toEqual(['Account', 'Contact', 'Lead']);
    expect(merged.items.find(({ name }) => name === 'Account')?.lastUsed).toEqual(new Date('2026-03-01T00:00:00Z'));
  });

  it('caps the merged list at 75 items', () => {
    const makeItems = (prefix: string, count: number) =>
      Array.from({ length: count }, (_, index) => ({ name: `${prefix}-${index}`, lastUsed: new Date('2026-01-01T00:00:00Z') }));
    const merged = mergeRecentHistoryItem(recent({ items: makeItems('a', 50) }), recent({ items: makeItems('b', 50) }));
    expect(merged.items).toHaveLength(75);
  });
});

describe('toQueryHistoryObject', () => {
  it('derives a lowercased key and string isTooling flag', () => {
    expect(toQueryHistoryObject(queryHistory({ org: 'O', sObject: 'Account', isTooling: true, label: 'Account Label' }))).toEqual({
      key: 'qho_o:account:true',
      org: 'O',
      sObject: 'Account',
      sObjectLabel: 'Account Label',
      isTooling: 'true',
    });
  });
});
