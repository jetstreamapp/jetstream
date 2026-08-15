import { parseQuery } from '@jetstreamapp/soql-parser-js';
import { describe, expect, it } from 'vitest';
import { applyColumnOrderToFields, reorderSubqueryFields } from '../query-results-utils';

function subqueryFieldNamesFor(fields: any[], relationshipName: string): string[] {
  const match = fields.find((field) => field.type === 'FieldSubquery' && field.subquery.relationshipName === relationshipName);
  return (match?.subquery.fields || []).map((field: any) => field.field ?? field.rawValue ?? field.type);
}

describe('applyColumnOrderToFields', () => {
  const fields = parseQuery('SELECT Id, Name, Email FROM Contact').fields || [];

  it('reorders when the permutation maps onto the fields 1:1', () => {
    const reordered = applyColumnOrderToFields(fields, [2, 0, 1]);

    expect((reordered || []).map((field: any) => field.field)).toEqual(['Email', 'Id', 'Name']);
  });

  it('bails when the column order has more entries than the subquery has fields', () => {
    // A subquery containing TYPEOF/FIELDS() renders more columns than it has AST fields
    expect(applyColumnOrderToFields(fields, [0, 1, 2, 3])).toBeNull();
  });

  it('bails when the column order has fewer entries than the subquery has fields', () => {
    expect(applyColumnOrderToFields(fields, [1, 0])).toBeNull();
  });

  it('bails on an out of range index rather than dropping the entry', () => {
    expect(applyColumnOrderToFields(fields, [0, 1, 7])).toBeNull();
  });
});

describe('reorderSubqueryFields', () => {
  it('reorders a top level subquery by relationship path', () => {
    const { fields } = parseQuery('SELECT Id, (SELECT Id, Email FROM Contacts) FROM Account');

    const result = reorderSubqueryFields(fields || [], ['Contacts'], [1, 0]);

    expect(subqueryFieldNamesFor(result || [], 'Contacts')).toEqual(['Email', 'Id']);
  });

  it('reorders a nested subquery without touching its parent', () => {
    const { fields } = parseQuery('SELECT Id, (SELECT Id, Name, (SELECT Id, Subject FROM Cases) FROM Contacts) FROM Account');

    const result = reorderSubqueryFields(fields || [], ['Contacts', 'Cases'], [1, 0]);
    const contacts = (result || []).find((field: any) => field.type === 'FieldSubquery') as any;

    expect(subqueryFieldNamesFor(contacts.subquery.fields, 'Cases')).toEqual(['Subject', 'Id']);
    // The parent keeps its own field order
    expect(contacts.subquery.fields.slice(0, 2).map((field: any) => field.field)).toEqual(['Id', 'Name']);
  });

  it('returns null when the relationship path does not resolve', () => {
    const { fields } = parseQuery('SELECT Id, (SELECT Id, Email FROM Contacts) FROM Account');

    expect(reorderSubqueryFields(fields || [], ['Bogus'], [1, 0])).toBeNull();
    expect(reorderSubqueryFields(fields || [], [], [1, 0])).toBeNull();
  });

  it('leaves a TYPEOF subquery alone rather than reordering against the flattened column list', () => {
    // 2 AST fields but 4 displayed columns, so the grid emits a 4 entry permutation
    const { fields } = parseQuery(
      'SELECT Id, (SELECT Id, TYPEOF What WHEN Account THEN Name, Industry ELSE Subject END FROM Tasks) FROM Contact',
    );

    expect(reorderSubqueryFields(fields || [], ['Tasks'], [3, 2, 1, 0])).toBeNull();
  });
});
