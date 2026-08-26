import type { ApexClassRecord } from '@jetstream/types';
import { describe, expect, it } from 'vitest';
import { distillSymbolTable } from '../apex-test-runner-symbol-table.utils';

function classRecord(symbolTable: ApexClassRecord['SymbolTable']): ApexClassRecord {
  return {
    Id: '01p000000000001',
    Name: 'MyClassTest',
    NamespacePrefix: null,
    Status: 'Active',
    LastModifiedDate: '2026-01-01T00:00:00.000Z',
    SymbolTable: symbolTable,
  };
}

describe('distillSymbolTable', () => {
  it('marks classes with a null SymbolTable as unknown (needs recompile)', () => {
    expect(distillSymbolTable(classRecord(null), '2026-01-01')).toEqual({
      lastModifiedDate: '2026-01-01',
      isTest: 'unknown',
      methods: [],
    });
  });

  it('detects test classes via the testMethod modifier and extracts test methods', () => {
    const entry = distillSymbolTable(
      classRecord({
        tableDeclaration: { name: 'MyClassTest', modifiers: ['testMethod', 'public'], annotations: [] },
        methods: [
          { name: 'testOne', modifiers: ['testMethod', 'static'], annotations: [], location: { line: 3, column: 1 } },
          { name: 'helper', modifiers: ['private', 'static'], annotations: [], location: { line: 10, column: 1 } },
        ],
      }),
      '2026-01-01',
    );
    expect(entry.isTest).toBe(true);
    expect(entry.methods).toEqual(['testOne']);
  });

  it('detects test classes and methods via the IsTest annotation', () => {
    const entry = distillSymbolTable(
      classRecord({
        tableDeclaration: { name: 'MyClassTest', modifiers: ['public'], annotations: [{ name: 'IsTest' }] },
        methods: [{ name: 'testTwo', modifiers: ['static'], annotations: [{ name: 'isTest' }], location: { line: 3, column: 1 } }],
      }),
      '2026-01-01',
    );
    expect(entry.isTest).toBe(true);
    expect(entry.methods).toEqual(['testTwo']);
  });

  it('marks non-test classes as isTest false', () => {
    const entry = distillSymbolTable(
      classRecord({
        tableDeclaration: { name: 'AccountService', modifiers: ['public'], annotations: [] },
        methods: [{ name: 'doWork', modifiers: ['public'], annotations: [], location: { line: 3, column: 1 } }],
      }),
      '2026-01-01',
    );
    expect(entry.isTest).toBe(false);
    expect(entry.methods).toEqual([]);
  });
});
