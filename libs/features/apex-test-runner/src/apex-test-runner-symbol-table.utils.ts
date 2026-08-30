import type { ApexClassRecord, ApexSymbolTable } from '@jetstream/types';
import type { ApexClassCacheEntry } from './apex-test-runner-types';

/**
 * Distill a SymbolTable into the cache entry we keep. The Apex compiler normalizes both the
 * `@IsTest` annotation and the legacy `testMethod` keyword into a `testMethod` modifier, but the
 * annotations are checked too as a safety net.
 */
export function distillSymbolTable(record: ApexClassRecord, lastModifiedDate: string): ApexClassCacheEntry {
  const symbolTable = record.SymbolTable;
  if (!symbolTable) {
    return { lastModifiedDate, isTest: 'unknown', methods: [] };
  }
  return {
    lastModifiedDate,
    isTest: isTestClass(symbolTable),
    methods: symbolTable.methods?.filter((method) => hasTestModifier(method.modifiers, method.annotations)).map(({ name }) => name) ?? [],
  };
}

function isTestClass(symbolTable: ApexSymbolTable): boolean {
  const { modifiers = [], annotations = [] } = symbolTable.tableDeclaration ?? {};
  return hasTestModifier(modifiers, annotations);
}

function hasTestModifier(modifiers: string[] = [], annotations: { name: string }[] = []): boolean {
  return (
    modifiers.some((modifier) => modifier.toLowerCase() === 'testmethod') ||
    annotations.some((annotation) => annotation.name.toLowerCase() === 'istest')
  );
}
