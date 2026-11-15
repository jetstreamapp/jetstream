import { describe, expect, it } from 'vitest';
import { mergeDivergedRecords } from '../sync-merge';

describe('mergeDivergedRecords', () => {
  const date = (day: number) => new Date(Date.UTC(2026, 0, day));

  it('keeps a favorite, the highest run count, the latest run and a custom label from either copy', () => {
    const local = { key: 'qh_1', isFavorite: true, runCount: 2, lastRun: date(1), createdAt: date(1), customLabel: null, soql: 'local' };
    const remote = {
      key: 'qh_1',
      isFavorite: false,
      runCount: 9,
      lastRun: date(5),
      createdAt: date(3),
      customLabel: 'Label',
      soql: 'remote',
    };

    expect(mergeDivergedRecords('query_history', local, remote)).toMatchObject({
      isFavorite: true,
      runCount: 9,
      lastRun: date(5),
      createdAt: date(1),
      customLabel: 'Label',
      // everything else comes from the copy that ran most recently
      soql: 'remote',
    });
  });

  it('combines recent items by name, newest first, tolerating items with no usable date', () => {
    const local = { key: 'ri_1', createdAt: date(1), items: [{ name: 'Account', lastUsed: date(2) }, { name: 'Legacy' }, null] };
    const remote = {
      key: 'ri_1',
      createdAt: date(1),
      items: [
        { name: 'Account', lastUsed: date(9) },
        { name: 'Contact', lastUsed: date(4) },
      ],
    };

    const merged = mergeDivergedRecords('recent_history_item', local, remote) as { items: Array<{ name: string; lastUsed: Date }> };

    expect(merged.items.map(({ name }) => name)).toEqual(['Account', 'Contact', 'Legacy']);
    expect(merged.items[0].lastUsed).toEqual(date(9));
  });

  it('keeps an API request favorited on either device', () => {
    const local = { key: 'api_1', isFavorite: 'false', lastRun: date(1), createdAt: date(1) };
    const remote = { key: 'api_1', isFavorite: 'true', lastRun: date(1), createdAt: date(1) };
    expect(mergeDivergedRecords('api_request_history', local, remote)).toMatchObject({ isFavorite: 'true' });
  });

  it('keeps the local copy of a saved mapping', () => {
    expect(mergeDivergedRecords('load_saved_mapping', { key: 'lsm_1', name: 'local' }, { key: 'lsm_1', name: 'remote' })).toEqual({
      key: 'lsm_1',
      name: 'local',
    });
  });
});
