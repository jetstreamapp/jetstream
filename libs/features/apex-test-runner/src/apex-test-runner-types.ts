import type { ApexTestQueueItemRecord, ApexTestResultRecord, ApexTestRunResultRecord } from '@jetstream/types';

/**
 * A test class available for selection. Distilled from the ApexClass manifest + SymbolTable —
 * full SymbolTables are never retained.
 */
export interface TestClassListItem {
  classId: string;
  name: string;
  lastModifiedDate: string;
  methods: string[];
  /** True when the SymbolTable was null (class needs recompile) — only class-level selection is possible */
  symbolTableUnavailable: boolean;
}

/** Cached per-org distillation of every active unmanaged class, keyed by class id */
export type ApexClassCacheEntry = {
  lastModifiedDate: string;
  isTest: boolean | 'unknown';
  methods: string[];
};

export type ApexClassCache = Record<string, ApexClassCacheEntry>;

/**
 * What the user chose to run. `'ALL'` runs every method in the class,
 * a Set runs only the chosen methods.
 */
export type TestRunSelection = { type: 'suite'; suiteId: string } | { type: 'tests'; classes: Map<string, Set<string> | 'ALL'> };

export interface TestRunDetailViewModel {
  run: ApexTestRunResultRecord | null;
  queueItems: ApexTestQueueItemRecord[];
  testResults: ApexTestResultRecord[];
}
