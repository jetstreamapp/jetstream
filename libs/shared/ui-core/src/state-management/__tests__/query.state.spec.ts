import { QueryFieldWithPolymorphic } from '@jetstream/types';
import { composeQuery } from '@jetstreamapp/soql-parser-js';
import { createStore } from 'jotai';
import { describe, expect, it } from 'vitest';
import * as fromQueryState from '../query.state';

function makeField(name: string): QueryFieldWithPolymorphic {
  return { field: name, polymorphicObj: undefined, metadata: { name } as any };
}

/** Compose the SELECT list the builder would produce for the given subquery state, against a root Account object. */
function composeFromState(state: {
  baseFields?: string[];
  subqueryFieldsByPath: Record<string, string[]>;
  limitsByPath?: Record<string, string>;
}) {
  const store = createStore();
  store.set(fromQueryState.selectedQueryFieldsState, (state.baseFields || ['Id']).map(makeField));
  store.set(
    fromQueryState.selectedSubqueryFieldsState,
    Object.entries(state.subqueryFieldsByPath).reduce((output: Record<string, QueryFieldWithPolymorphic[]>, [path, fields]) => {
      output[path] = fields.map(makeField);
      return output;
    }, {}),
  );
  if (state.limitsByPath) {
    store.set(fromQueryState.querySubqueryLimitState, state.limitsByPath);
  }
  return composeQuery({ sObject: 'Account', fields: store.get(fromQueryState.selectQueryField) });
}

describe('selectQueryField — nested subqueries', () => {
  it('nests a subquery within its parent based on the relationship path', () => {
    const soql = composeFromState({
      subqueryFieldsByPath: { Contacts: ['Id', 'Email'], 'Contacts.Cases': ['Id', 'Subject'] },
    });

    expect(soql).toBe('SELECT Id, (SELECT Id, Email, (SELECT Id, Subject FROM Cases) FROM Contacts) FROM Account');
  });

  it('keeps sibling subqueries at their own level', () => {
    const soql = composeFromState({
      subqueryFieldsByPath: { Contacts: ['Id'], 'Contacts.Cases': ['Id'], 'Contacts.Assets': ['Id'] },
    });

    expect(soql).toBe('SELECT Id, (SELECT Id, (SELECT Id FROM Assets), (SELECT Id FROM Cases) FROM Contacts) FROM Account');
  });

  it('applies limit to the subquery identified by its path, not by relationship name', () => {
    const soql = composeFromState({
      subqueryFieldsByPath: { Cases: ['Id'], Contacts: ['Id'], 'Contacts.Cases': ['Id'] },
      limitsByPath: { 'Contacts.Cases': '5' },
    });

    expect(soql).toBe('SELECT Id, (SELECT Id FROM Cases), (SELECT Id, (SELECT Id FROM Cases LIMIT 5) FROM Contacts) FROM Account');
  });

  it('drops a subquery with no fields anywhere beneath it', () => {
    const soql = composeFromState({ subqueryFieldsByPath: { Contacts: [], 'Contacts.Cases': [] } });

    expect(soql).toBe('SELECT Id FROM Account');
  });

  it('keeps a parent subquery that has no fields of its own when a nested one does', () => {
    const soql = composeFromState({ subqueryFieldsByPath: { Contacts: [], 'Contacts.Cases': ['Id'] } });

    expect(soql).toBe('SELECT Id, (SELECT (SELECT Id FROM Cases) FROM Contacts) FROM Account');
  });

  it('emits a nested subquery whose parent has no entry of its own in state', () => {
    const soql = composeFromState({ subqueryFieldsByPath: { 'Contacts.Cases': ['Id'] } });

    expect(soql).toBe('SELECT Id, (SELECT (SELECT Id FROM Cases) FROM Contacts) FROM Account');
  });
});

describe('selectSubqueryCount', () => {
  function countFor(subqueryFieldsByPath: Record<string, string[]>) {
    const store = createStore();
    store.set(
      fromQueryState.selectedSubqueryFieldsState,
      Object.entries(subqueryFieldsByPath).reduce((output: Record<string, QueryFieldWithPolymorphic[]>, [path, fields]) => {
        output[path] = fields.map(makeField);
        return output;
      }, {}),
    );
    return store.get(fromQueryState.selectSubqueryCount);
  }

  it('counts only top level subqueries, not nested ones', () => {
    expect(countFor({ Contacts: ['Id'], 'Contacts.Cases': ['Id'], Opportunities: ['Id'] })).toBe(2);
  });

  it('ignores subqueries with no fields anywhere beneath them', () => {
    expect(countFor({ Contacts: ['Id'], Opportunities: [] })).toBe(1);
  });

  it('counts a top level subquery that only has fields on something nested within it', () => {
    expect(countFor({ Contacts: [], 'Contacts.Cases': ['Id'] })).toBe(1);
  });

  it('is zero when nothing is selected', () => {
    expect(countFor({})).toBe(0);
  });
});

describe('clearSubqueriesBelow', () => {
  function makeStore(subqueryFieldsByPath: Record<string, string[]>) {
    const store = createStore();
    store.set(
      fromQueryState.selectedSubqueryFieldsState,
      Object.entries(subqueryFieldsByPath).reduce((output: Record<string, QueryFieldWithPolymorphic[]>, [path, fields]) => {
        output[path] = fields.map(makeField);
        return output;
      }, {}),
    );
    return store;
  }

  it('clears every subquery when given the root object', () => {
    const store = makeStore({ Contacts: ['Id'], 'Contacts.Cases': ['Id'], Opportunities: ['Id'] });

    store.set(fromQueryState.clearSubqueriesBelow, '');

    expect(store.get(fromQueryState.selectedSubqueryFieldsState)).toEqual({});
    expect(store.get(fromQueryState.selectSubqueryCount)).toBe(0);
  });

  it('clears everything nested beneath a path but leaves that subquery itself alone', () => {
    const store = makeStore({
      Contacts: ['Id'],
      'Contacts.Cases': ['Id'],
      'Contacts.Cases.CaseComments': ['Id'],
      Opportunities: ['Id'],
    });

    store.set(fromQueryState.clearSubqueriesBelow, 'Contacts');

    // Contacts was selected one level up, so it survives along with its unrelated sibling
    expect(Object.keys(store.get(fromQueryState.selectedSubqueryFieldsState)).sort()).toEqual(['Contacts', 'Opportunities']);
  });

  it('does not clear a sibling whose name merely starts with the same text', () => {
    const store = makeStore({ Contacts: ['Id'], ContactsExtra: ['Id'], 'Contacts.Cases': ['Id'] });

    store.set(fromQueryState.clearSubqueriesBelow, 'Contacts');

    expect(Object.keys(store.get(fromQueryState.selectedSubqueryFieldsState)).sort()).toEqual(['Contacts', 'ContactsExtra']);
  });

  it('clears the filter, order by, and limit options of the removed subqueries', () => {
    const store = makeStore({ Contacts: ['Id'], 'Contacts.Cases': ['Id'] });
    store.set(fromQueryState.querySubqueryLimitState, { Contacts: '5', 'Contacts.Cases': '10' });
    store.set(fromQueryState.querySubqueryOrderByState, {
      'Contacts.Cases': [{ key: 0, field: 'Id', fieldLabel: 'Id', order: 'ASC', nulls: null }],
    });

    store.set(fromQueryState.clearSubqueriesBelow, 'Contacts');

    expect(store.get(fromQueryState.querySubqueryLimitState)).toEqual({ Contacts: '5' });
    expect(store.get(fromQueryState.querySubqueryOrderByState)).toEqual({});
  });

  it('clears the field selections backing the pickers without discarding fetched metadata', () => {
    const store = makeStore({ Contacts: ['Id'], 'Contacts.Cases': ['Id'] });
    store.set(fromQueryState.queryFieldsMapState, {
      'Account|': { key: 'Account|', selectedFields: new Set(['Id']), sobject: 'Account' } as any,
      'Contact~Contacts|': { key: 'Contact~Contacts|', selectedFields: new Set(['Id']), sobject: 'Contact' } as any,
      'Case~Contacts.Cases|': { key: 'Case~Contacts.Cases|', selectedFields: new Set(['Id']), sobject: 'Case' } as any,
      'Case~Contacts.Cases|Account.': { key: 'Case~Contacts.Cases|Account.', selectedFields: new Set(['Name']), sobject: 'Account' } as any,
    });

    store.set(fromQueryState.clearSubqueriesBelow, 'Contacts');
    const fieldsMap = store.get(fromQueryState.queryFieldsMapState);

    expect(fieldsMap['Case~Contacts.Cases|'].selectedFields).toEqual(new Set());
    expect(fieldsMap['Case~Contacts.Cases|Account.'].selectedFields).toEqual(new Set());
    // The base object and the surviving subquery keep their selections
    expect(fieldsMap['Account|'].selectedFields).toEqual(new Set(['Id']));
    expect(fieldsMap['Contact~Contacts|'].selectedFields).toEqual(new Set(['Id']));
    // Metadata entries are kept so re-expanding does not have to re-fetch
    expect(Object.keys(fieldsMap).sort()).toEqual([
      'Account|',
      'Case~Contacts.Cases|',
      'Case~Contacts.Cases|Account.',
      'Contact~Contacts|',
    ]);
  });

  it('closes the subquery config panel when it targets a removed subquery', () => {
    const store = makeStore({ Contacts: ['Id'], 'Contacts.Cases': ['Id'] });
    store.set(fromQueryState.subqueryConfigPanelState, { relationshipPath: 'Contacts.Cases', childSObject: 'Case' });

    store.set(fromQueryState.clearSubqueriesBelow, 'Contacts');

    expect(store.get(fromQueryState.subqueryConfigPanelState)).toBeNull();
  });

  it('leaves the config panel open when it targets a surviving subquery', () => {
    const store = makeStore({ Contacts: ['Id'], 'Contacts.Cases': ['Id'] });
    store.set(fromQueryState.subqueryConfigPanelState, { relationshipPath: 'Contacts', childSObject: 'Contact' });

    store.set(fromQueryState.clearSubqueriesBelow, 'Contacts');

    expect(store.get(fromQueryState.subqueryConfigPanelState)).toEqual({ relationshipPath: 'Contacts', childSObject: 'Contact' });
  });
});
