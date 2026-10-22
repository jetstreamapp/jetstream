import { createStore } from 'jotai';
import { describe, expect, it } from 'vitest';
import * as fromLoadRecordsState from '../load-records.state';

function createStoreWithRecords(numRecords: number | null) {
  const store = createStore();
  const records = numRecords === null ? null : Array.from({ length: numRecords }, (_, index) => ({ Id: `001${index}` }));
  store.set(fromLoadRecordsState.inputFileDataState, records);
  return store;
}

describe('selectIsTrialRunAvailable', () => {
  it('is unavailable until there are at least two records to split between the trial run and the main load', () => {
    expect(createStoreWithRecords(null).get(fromLoadRecordsState.selectIsTrialRunAvailable)).toBe(false);
    expect(createStoreWithRecords(0).get(fromLoadRecordsState.selectIsTrialRunAvailable)).toBe(false);
    expect(createStoreWithRecords(1).get(fromLoadRecordsState.selectIsTrialRunAvailable)).toBe(false);
  });

  it('is available with two or more records', () => {
    expect(createStoreWithRecords(2).get(fromLoadRecordsState.selectIsTrialRunAvailable)).toBe(true);
    expect(createStoreWithRecords(500).get(fromLoadRecordsState.selectIsTrialRunAvailable)).toBe(true);
  });
});

describe('selectTrialRunSizeError', () => {
  it('requires the trial run size to leave at least one record for the main load', () => {
    const store = createStoreWithRecords(3);

    store.set(fromLoadRecordsState.trialRunSizeState, 1);
    expect(store.get(fromLoadRecordsState.selectTrialRunSizeError)).toBeNull();

    store.set(fromLoadRecordsState.trialRunSizeState, 2);
    expect(store.get(fromLoadRecordsState.selectTrialRunSizeError)).toBeNull();

    store.set(fromLoadRecordsState.trialRunSizeState, 3);
    expect(store.get(fromLoadRecordsState.selectTrialRunSizeError)).toBe('Must be between 1 and 2');
  });
});
