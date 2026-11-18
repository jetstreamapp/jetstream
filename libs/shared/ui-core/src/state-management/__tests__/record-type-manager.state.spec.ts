import { ListItem, ListMetadataResult } from '@jetstream/types';
import { createStore } from 'jotai';
import { describe, expect, it } from 'vitest';
import * as fromRecordTypeManagerState from '../record-type-manager.state';

function makeRecordTypeItem(fullName: string): ListItem<string, ListMetadataResult> {
  return { id: fullName, label: fullName, value: fullName, meta: { fullName } as ListMetadataResult };
}

describe('selectedRecordTypes', () => {
  it('returns the list items for the selected ids', () => {
    const store = createStore();
    store.set(fromRecordTypeManagerState.recordTypesState, [makeRecordTypeItem('Case.Support'), makeRecordTypeItem('Case.Billing')]);
    store.set(fromRecordTypeManagerState.selectedRecordTypeIds, ['Case.Billing']);

    expect(store.get(fromRecordTypeManagerState.selectedRecordTypes).map(({ fullName }) => fullName)).toEqual(['Case.Billing']);
  });

  it('skips selected ids that are not in the list, such as while the list is being refetched', () => {
    const store = createStore();
    store.set(fromRecordTypeManagerState.recordTypesState, [makeRecordTypeItem('Case.Support')]);
    store.set(fromRecordTypeManagerState.selectedRecordTypeIds, ['Case.Support', 'Case.Deleted']);

    expect(store.get(fromRecordTypeManagerState.selectedRecordTypes).map(({ fullName }) => fullName)).toEqual(['Case.Support']);

    store.set(fromRecordTypeManagerState.recordTypesState, []);
    expect(store.get(fromRecordTypeManagerState.selectedRecordTypes)).toEqual([]);
  });
});
