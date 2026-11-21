import { SalesforceOrgUi } from '@jetstream/types';
import Dexie from 'dexie';
import { IDBFactory, IDBKeyRange } from 'fake-indexeddb';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { queryHistoryDb } from '../query-history.db';
import { createDexieInstance, getDexieDb, setDexieDbInstance } from '../ui-db';

const ORG_A = { uniqueId: 'org-a' } as SalesforceOrgUi;
const ORG_B = { uniqueId: 'org-b' } as SalesforceOrgUi;
const SOQL = 'SELECT Id FROM Account';
// Passing the label up front keeps these specs away from the describe call used to look it up
const SAVE_OPTIONS = { sObjectLabel: 'Account' };

describe('queryHistoryDb', () => {
  beforeAll(() => {
    Dexie.dependencies.indexedDB = new IDBFactory();
    Dexie.dependencies.IDBKeyRange = IDBKeyRange;
    setDexieDbInstance(createDexieInstance('query-history-spec'));
  });

  beforeEach(async () => {
    await getDexieDb().query_history.clear();
  });

  describe('recordCount', () => {
    it('stores the record count from the latest run', async () => {
      await queryHistoryDb.saveQueryHistoryItem(ORG_A, SOQL, 'Account', { ...SAVE_OPTIONS, incrementRunCount: true, recordCount: 12 });
      const item = await queryHistoryDb.saveQueryHistoryItem(ORG_A, SOQL, 'Account', {
        ...SAVE_OPTIONS,
        incrementRunCount: true,
        recordCount: 15,
      });

      expect(item.runCount).toBe(2);
      expect(item.recordCount).toBe(15);
      expect((await getDexieDb().query_history.get(item.key))?.recordCount).toBe(15);
    });

    it('stores a count of zero', async () => {
      const item = await queryHistoryDb.saveQueryHistoryItem(ORG_A, SOQL, 'Account', { ...SAVE_OPTIONS, recordCount: 0 });
      expect(item.recordCount).toBe(0);
    });

    it('keeps the existing count when a save does not provide one', async () => {
      await queryHistoryDb.saveQueryHistoryItem(ORG_A, SOQL, 'Account', { ...SAVE_OPTIONS, recordCount: 12 });
      const item = await queryHistoryDb.saveQueryHistoryItem(ORG_A, SOQL, 'Account', { ...SAVE_OPTIONS, isFavorite: true });

      expect(item.isFavorite).toBe(true);
      expect(item.recordCount).toBe(12);
    });
  });

  describe('updateSavedQuery', () => {
    it('keeps the record count when only the label changes', async () => {
      const item = await queryHistoryDb.saveQueryHistoryItem(ORG_A, SOQL, 'Account', {
        ...SAVE_OPTIONS,
        isFavorite: true,
        recordCount: 12,
      });
      const updatedItem = await queryHistoryDb.updateSavedQuery(ORG_A, item, SOQL, 'My accounts', false);

      expect(updatedItem.key).toBe(item.key);
      expect(updatedItem.customLabel).toBe('My accounts');
      expect(updatedItem.recordCount).toBe(12);
    });

    it('drops the record count when the SOQL changes', async () => {
      const item = await queryHistoryDb.saveQueryHistoryItem(ORG_A, SOQL, 'Account', {
        ...SAVE_OPTIONS,
        isFavorite: true,
        recordCount: 12,
      });
      const updatedItem = await queryHistoryDb.updateSavedQuery(ORG_A, item, `${SOQL} LIMIT 5`, 'Account', false);

      expect(updatedItem.key).not.toBe(item.key);
      expect(updatedItem.recordCount).toBeNull();
      expect(await getDexieDb().query_history.get(item.key)).toBeUndefined();
    });

    it('keys the edited query by the org it belongs to', async () => {
      const item = await queryHistoryDb.saveQueryHistoryItem(ORG_B, SOQL, 'Account', { ...SAVE_OPTIONS, isFavorite: true });
      const updatedItem = await queryHistoryDb.updateSavedQuery(ORG_B, item, `${SOQL} LIMIT 5`, 'Account', false);

      expect(updatedItem.org).toBe('org-b');
      expect(updatedItem.key.startsWith('qh_org-b:')).toBe(true);
    });
  });
});
