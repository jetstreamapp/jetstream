import { parseQuery } from '@jetstreamapp/soql-parser-js';
import { describe, expect, it } from 'vitest';
import {
  getSubqueryParentPath,
  getSubqueryPath,
  getSubqueryPathDepth,
  getSubqueryPathSegments,
  getSubqueryPathWithAncestors,
  getSubqueryRelationshipName,
  isDirectChildSubqueryPath,
  isSubqueryPathBelow,
  walkSubqueries,
} from '../subquery-path-utils';

describe('getSubqueryPath', () => {
  it('returns the relationship name for a top level subquery', () => {
    expect(getSubqueryPath('', 'Contacts')).toBe('Contacts');
  });

  it('joins onto the parent path for a nested subquery', () => {
    expect(getSubqueryPath('Contacts', 'Cases')).toBe('Contacts.Cases');
    expect(getSubqueryPath('Contacts.Cases', 'CaseComments')).toBe('Contacts.Cases.CaseComments');
  });
});

describe('getSubqueryPathSegments / getSubqueryPathDepth', () => {
  it('treats an empty path as the root object', () => {
    expect(getSubqueryPathSegments('')).toEqual([]);
    expect(getSubqueryPathDepth('')).toBe(0);
  });

  it('counts one level per relationship', () => {
    expect(getSubqueryPathSegments('Contacts.Cases')).toEqual(['Contacts', 'Cases']);
    expect(getSubqueryPathDepth('Contacts')).toBe(1);
    expect(getSubqueryPathDepth('Contacts.Cases.CaseComments')).toBe(3);
  });
});

describe('getSubqueryParentPath / getSubqueryRelationshipName', () => {
  it('splits a nested path into its parent and its own relationship name', () => {
    expect(getSubqueryParentPath('Contacts.Cases')).toBe('Contacts');
    expect(getSubqueryRelationshipName('Contacts.Cases')).toBe('Cases');
  });

  it('reports the root as the parent of a top level subquery', () => {
    expect(getSubqueryParentPath('Contacts')).toBe('');
    expect(getSubqueryRelationshipName('Contacts')).toBe('Contacts');
  });

  it('handles an empty path', () => {
    expect(getSubqueryParentPath('')).toBe('');
    expect(getSubqueryRelationshipName('')).toBe('');
  });
});

describe('getSubqueryPathWithAncestors', () => {
  it('returns every ancestor shallowest first, including the path itself', () => {
    expect(getSubqueryPathWithAncestors('Contacts.Cases.CaseComments')).toEqual([
      'Contacts',
      'Contacts.Cases',
      'Contacts.Cases.CaseComments',
    ]);
  });

  it('returns an empty list for the root', () => {
    expect(getSubqueryPathWithAncestors('')).toEqual([]);
  });
});

describe('walkSubqueries', () => {
  function pathsFor(soql: string) {
    return Array.from(walkSubqueries(parseQuery(soql).fields)).map(({ relationshipPath }) => relationshipPath);
  }

  it('yields nothing when there are no subqueries', () => {
    expect(pathsFor('SELECT Id, Name FROM Account')).toEqual([]);
  });

  it('yields each parent before its own children, depth first', () => {
    expect(pathsFor('SELECT Id, (SELECT Id, (SELECT Id FROM Cases) FROM Contacts), (SELECT Id FROM Opportunities) FROM Account')).toEqual([
      'Contacts',
      'Contacts.Cases',
      'Opportunities',
    ]);
  });

  it('preserves the casing used in the query so callers can match case-insensitively', () => {
    expect(pathsFor('SELECT Id, (SELECT Id, (SELECT Id FROM cases) FROM contacts) FROM Account')).toEqual(['contacts', 'contacts.cases']);
  });

  it('yields the subquery alongside its path', () => {
    const [first] = Array.from(walkSubqueries(parseQuery('SELECT Id, (SELECT Id, Name FROM Contacts) FROM Account').fields));

    expect(first.relationshipPath).toBe('Contacts');
    expect(first.parentRelationshipPath).toBe('');
    expect(first.subquery.relationshipName).toBe('Contacts');
  });

  it('reports the parent path of a nested subquery', () => {
    const entries = Array.from(
      walkSubqueries(parseQuery('SELECT Id, (SELECT Id, (SELECT Id FROM Cases) FROM Contacts) FROM Account').fields),
    );

    expect(entries[1].parentRelationshipPath).toBe('Contacts');
  });
});

describe('isSubqueryPathBelow', () => {
  it('matches any depth beneath the parent', () => {
    expect(isSubqueryPathBelow('Contacts.Cases', 'Contacts')).toBe(true);
    expect(isSubqueryPathBelow('Contacts.Cases.CaseComments', 'Contacts')).toBe(true);
  });

  it('does not match the parent itself', () => {
    expect(isSubqueryPathBelow('Contacts', 'Contacts')).toBe(false);
  });

  it('treats the root object as the parent of every subquery', () => {
    expect(isSubqueryPathBelow('Contacts', '')).toBe(true);
    expect(isSubqueryPathBelow('Contacts.Cases', '')).toBe(true);
  });

  it('does not match a sibling whose name merely starts with the parent name', () => {
    expect(isSubqueryPathBelow('ContactsExtra', 'Contacts')).toBe(false);
  });

  it('is case insensitive, since query casing may not match metadata', () => {
    expect(isSubqueryPathBelow('contacts.cases', 'Contacts')).toBe(true);
  });

  it('detects descendants at any depth, which is how a parent with no fields of its own stays reachable', () => {
    const selectedPaths = ['Contacts.Cases.CaseComments'];

    expect(selectedPaths.some((path) => isSubqueryPathBelow(path, 'Contacts'))).toBe(true);
    expect(selectedPaths.some((path) => isSubqueryPathBelow(path, 'Opportunities'))).toBe(false);
  });
});

describe('isDirectChildSubqueryPath', () => {
  it('matches only one level below the parent', () => {
    expect(isDirectChildSubqueryPath('Contacts', '')).toBe(true);
    expect(isDirectChildSubqueryPath('Contacts.Cases', 'Contacts')).toBe(true);
    expect(isDirectChildSubqueryPath('Contacts.Cases', '')).toBe(false);
    expect(isDirectChildSubqueryPath('Contacts.Cases.CaseComments', 'Contacts')).toBe(false);
  });

  it('is case insensitive on the parent path, since query casing may not match metadata', () => {
    expect(isDirectChildSubqueryPath('Contacts.Cases', 'contacts')).toBe(true);
  });

  it('does not treat a path as its own child', () => {
    expect(isDirectChildSubqueryPath('Contacts', 'Contacts')).toBe(false);
  });
});
