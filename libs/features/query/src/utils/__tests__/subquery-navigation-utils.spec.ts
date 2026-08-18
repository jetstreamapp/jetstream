import { QueryFields, QueryFieldWithPolymorphic } from '@jetstream/types';
import { getQueryFieldBaseKey, getSubqueryFieldBaseKey, initQueryFieldStateItem } from '@jetstream/ui-core/shared';
import { describe, expect, it } from 'vitest';
import {
  buildSelectedSubqueryTree,
  countSubqueriesBelow,
  flattenSelectedSubqueryTree,
  getAncestorDrillLevels,
  getSelectedSubqueryNodesByPath,
  getSubquerySObjectByPath,
} from '../subquery-navigation-utils';

/** Only the number of selected fields matters to the tree, so the field metadata is not worth building out */
function getFields(...fields: string[]): QueryFieldWithPolymorphic[] {
  return fields.map((field) => ({ field }) as QueryFieldWithPolymorphic);
}

function getQueryFieldsMap(entries: { key: string; sobject: string }[]): Record<string, QueryFields> {
  return entries.reduce((output: Record<string, QueryFields>, { key, sobject }) => {
    output[key] = initQueryFieldStateItem(key, sobject);
    return output;
  }, {});
}

describe('getSubquerySObjectByPath', () => {
  it('should map each subquery path to the object it selects from', () => {
    const queryFieldsMap = getQueryFieldsMap([
      { key: getQueryFieldBaseKey('Account'), sobject: 'Account' },
      { key: getSubqueryFieldBaseKey('Contact', 'Contacts'), sobject: 'Contact' },
      { key: getSubqueryFieldBaseKey('Case', 'Contacts.Cases'), sobject: 'Case' },
    ]);

    expect(getSubquerySObjectByPath(queryFieldsMap)).toEqual({ Contacts: 'Contact', 'Contacts.Cases': 'Case' });
  });

  it('should ignore parent relationships expanded within a subquery, which share the subquery path', () => {
    const queryFieldsMap = getQueryFieldsMap([
      { key: getSubqueryFieldBaseKey('Contact', 'Contacts'), sobject: 'Contact' },
      { key: `${getSubqueryFieldBaseKey('Contact', 'Contacts')}Owner.`, sobject: 'User' },
    ]);

    expect(getSubquerySObjectByPath(queryFieldsMap)).toEqual({ Contacts: 'Contact' });
  });
});

describe('buildSelectedSubqueryTree', () => {
  const sObjectByPath = {
    Contacts: 'Contact',
    'Contacts.Cases': 'Case',
    'Contacts.Cases.CaseComments': 'CaseComment',
    Opportunities: 'Opportunity',
  };

  it('should nest each subquery within its parent, ordered by relationship name', () => {
    const tree = buildSelectedSubqueryTree(
      {
        Opportunities: getFields('Id'),
        Contacts: getFields('Id', 'Name'),
        'Contacts.Cases': getFields('Id'),
      },
      sObjectByPath,
    );

    expect(tree).toEqual([
      {
        relationshipPath: 'Contacts',
        relationshipName: 'Contacts',
        childSObject: 'Contact',
        fieldCount: 2,
        children: [{ relationshipPath: 'Contacts.Cases', relationshipName: 'Cases', childSObject: 'Case', fieldCount: 1, children: [] }],
      },
      {
        relationshipPath: 'Opportunities',
        relationshipName: 'Opportunities',
        childSObject: 'Opportunity',
        fieldCount: 1,
        children: [],
      },
    ]);
  });

  it('should include ancestors of a nested selection even when they have no fields of their own', () => {
    const tree = buildSelectedSubqueryTree({ 'Contacts.Cases.CaseComments': getFields('Id') }, sObjectByPath);

    expect(flattenSelectedSubqueryTree(tree).map(({ relationshipPath, fieldCount }) => ({ relationshipPath, fieldCount }))).toEqual([
      { relationshipPath: 'Contacts', fieldCount: 0 },
      { relationshipPath: 'Contacts.Cases', fieldCount: 0 },
      { relationshipPath: 'Contacts.Cases.CaseComments', fieldCount: 1 },
    ]);
  });

  it('should omit subqueries that no longer have fields anywhere within them', () => {
    expect(buildSelectedSubqueryTree({ Contacts: [], 'Contacts.Cases': [] }, sObjectByPath)).toEqual([]);
  });
});

describe('countSubqueriesBelow', () => {
  const tree = buildSelectedSubqueryTree(
    {
      Contacts: getFields('Id'),
      'Contacts.Cases': getFields('Id'),
      'Contacts.Cases.CaseComments': getFields('Id'),
      Opportunities: getFields('Id'),
    },
    {},
  );

  it('should count every subquery in the query from the root object', () => {
    expect(countSubqueriesBelow(tree, '')).toBe(4);
  });

  it('should count only what is nested beneath the level being viewed', () => {
    expect(countSubqueriesBelow(tree, 'Contacts')).toBe(2);
    expect(countSubqueriesBelow(tree, 'Contacts.Cases')).toBe(1);
    expect(countSubqueriesBelow(tree, 'Opportunities')).toBe(0);
  });
});

describe('getSelectedSubqueryNodesByPath', () => {
  const tree = buildSelectedSubqueryTree({ Contacts: getFields('Id'), 'Contacts.Cases': getFields('Id') }, { Contacts: 'Contact' });

  it('should find a node regardless of the casing the path is looked up with', () => {
    const nodesByPath = getSelectedSubqueryNodesByPath(tree);

    expect(nodesByPath.get('contacts.cases')?.relationshipPath).toBe('Contacts.Cases');
    expect(nodesByPath.size).toBe(2);
  });

  it('should only hold the subqueries the query contains, so a missing node means it is not selected', () => {
    expect(getSelectedSubqueryNodesByPath(tree).has('opportunities')).toBe(false);
  });

  it('should carry what is nested directly within each node', () => {
    const nodesByPath = getSelectedSubqueryNodesByPath(tree);

    expect(nodesByPath.get('contacts')?.children.length).toBe(1);
    expect(nodesByPath.get('contacts.cases')?.children.length).toBe(0);
  });
});

describe('getAncestorDrillLevels', () => {
  const tree = buildSelectedSubqueryTree(
    { 'Contacts.Cases.CaseComments': getFields('Id') },
    { Contacts: 'Contact', 'Contacts.Cases': 'Case', 'Contacts.Cases.CaseComments': 'CaseComment' },
  );

  it('should drill into every ancestor, shallowest first, so the level that lists the target is shown', () => {
    expect(getAncestorDrillLevels(tree, 'Contacts.Cases.CaseComments')).toEqual([
      { relationshipPath: 'Contacts', relationshipName: 'Contacts', childSObject: 'Contact' },
      { relationshipPath: 'Contacts.Cases', relationshipName: 'Cases', childSObject: 'Case' },
    ]);
  });

  it('should stay on the root object for a top level subquery, which the root already lists', () => {
    expect(getAncestorDrillLevels(tree, 'Contacts')).toEqual([]);
  });

  it('should navigate to the root object itself without any level drilled into', () => {
    expect(getAncestorDrillLevels(tree, '')).toEqual([]);
  });

  it('should match ancestors case-insensitively, since paths carry whatever casing they were authored with', () => {
    expect(getAncestorDrillLevels(tree, 'contacts.cases.casecomments').map(({ relationshipPath }) => relationshipPath)).toEqual([
      'Contacts',
      'Contacts.Cases',
    ]);
  });
});
