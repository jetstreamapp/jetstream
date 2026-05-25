import { DescribeSObjectResult, Field, FieldWrapper, QueryFields } from '@jetstream/types';
import { getSubqueryFieldBaseKey, SoqlFetchMetadataOutput } from '@jetstream/ui-core/shared';
import { parseQuery, Query } from '@jetstreamapp/soql-parser-js';
import { describe, expect, it } from 'vitest';
import { __TEST_EXPORTS__ } from '../query-restore-utils';

const { processSubqueryOptions, getFieldWrapperPathForSubquery } = __TEST_EXPORTS__;

function makeField(overrides: Partial<Field>): Field {
  return {
    name: 'Id',
    label: 'Id',
    type: 'id',
    filterable: true,
    sortable: true,
    referenceTo: [],
    ...overrides,
  } as Field;
}

function makeFieldWrapper(field: Field): FieldWrapper {
  return {
    name: field.name,
    label: field.label,
    type: field.type,
    sobject: '',
    filterText: `${field.name} ${field.label}`,
    metadata: field,
  } as FieldWrapper;
}

function makeQueryFields(key: string, fields: Field[]): QueryFields {
  return {
    key,
    isPolymorphic: false,
    expanded: true,
    loading: false,
    hasError: false,
    filterTerm: '',
    sobject: '',
    fields: fields.reduce((acc: Record<string, FieldWrapper>, field) => {
      acc[field.name] = makeFieldWrapper(field);
      return acc;
    }, {}),
    visibleFields: new Set(fields.map((f) => f.name)),
    selectedFields: new Set(),
    metadata: { fields } as DescribeSObjectResult,
  } as QueryFields;
}

function makeMetadataOutput(relationshipName: string, childSObjectName: string): SoqlFetchMetadataOutput {
  return {
    sobjectMetadata: [],
    selectedSobjectMetadata: { global: {} as any, sobject: {} as any },
    metadata: {},
    lowercaseFieldMap: {},
    childMetadata: {
      [relationshipName]: {
        objectMetadata: { name: childSObjectName } as DescribeSObjectResult,
        metadataTree: {},
        lowercaseFieldMap: {},
      },
    },
  };
}

describe('getFieldWrapperPathForSubquery', () => {
  it('only returns entries under the provided child base key', () => {
    const childBaseKey = getSubqueryFieldBaseKey('Contact', 'Contacts');
    const otherBaseKey = 'Account|';
    const queryFields = {
      [childBaseKey]: makeQueryFields(childBaseKey, [makeField({ name: 'Email' }), makeField({ name: 'Name' })]),
      [otherBaseKey]: makeQueryFields(otherBaseKey, [makeField({ name: 'TopLevelField' })]),
    };

    const result = getFieldWrapperPathForSubquery(queryFields, childBaseKey);

    expect(Object.keys(result).sort()).toEqual(['email', 'name']);
    expect(result['email'].fieldKey).toBe('Email');
  });

  it('prefixes field keys with the dotted relationship path for nested child entries', () => {
    const childBaseKey = getSubqueryFieldBaseKey('Contact', 'Contacts');
    const nestedKey = `${childBaseKey}Account.`;
    const queryFields = {
      [childBaseKey]: makeQueryFields(childBaseKey, [makeField({ name: 'Email' })]),
      [nestedKey]: makeQueryFields(nestedKey, [makeField({ name: 'Industry' })]),
    };

    const result = getFieldWrapperPathForSubquery(queryFields, childBaseKey);

    expect(result['email'].fieldKey).toBe('Email');
    expect(result['account.industry'].fieldKey).toBe('Account.Industry');
    expect(result['account.industry'].parentKey).toBe(nestedKey);
  });
});

describe('processSubqueryOptions', () => {
  function runProcess(soql: string, childBaseKey: string, queryFields: Record<string, QueryFields>, metadata: SoqlFetchMetadataOutput) {
    const stateItems: any = { queryFieldsMapState: queryFields, missingMisc: [] };
    const query: Query = parseQuery(soql);
    processSubqueryOptions(stateItems, query, metadata);
    return { stateItems, query };
  }

  it('restores simple filter, orderBy, and limit on a flat subquery', () => {
    const childBaseKey = getSubqueryFieldBaseKey('Contact', 'Contacts');
    const queryFields = {
      [childBaseKey]: makeQueryFields(childBaseKey, [makeField({ name: 'Email' }), makeField({ name: 'CreatedDate', type: 'datetime' })]),
    };
    const metadata = makeMetadataOutput('Contacts', 'Contact');

    const { stateItems } = runProcess(
      `SELECT Id, (SELECT Id FROM Contacts WHERE Email != null ORDER BY CreatedDate DESC LIMIT 5) FROM Account`,
      childBaseKey,
      queryFields,
      metadata,
    );

    expect(stateItems.querySubqueryFiltersState.Contacts).toEqual(
      expect.objectContaining({
        action: 'AND',
        rows: expect.arrayContaining([
          expect.objectContaining({ selected: expect.objectContaining({ resource: 'Email', operator: 'isNotNull' }) }),
        ]),
      }),
    );
    expect(stateItems.querySubqueryOrderByState.Contacts).toEqual([expect.objectContaining({ field: 'CreatedDate', order: 'DESC' })]);
    expect(stateItems.querySubqueryLimitState.Contacts).toBe('5');
    expect(stateItems.missingMisc).toEqual([]);
  });

  it('restores a subquery filter that references a relationship field (dotted path)', () => {
    const childBaseKey = getSubqueryFieldBaseKey('Contact', 'Contacts');
    const nestedKey = `${childBaseKey}Account.`;
    const queryFields = {
      [childBaseKey]: makeQueryFields(childBaseKey, [makeField({ name: 'Email' })]),
      [nestedKey]: makeQueryFields(nestedKey, [makeField({ name: 'Industry', type: 'picklist' })]),
    };
    const metadata = makeMetadataOutput('Contacts', 'Contact');

    const { stateItems } = runProcess(
      `SELECT Id, (SELECT Id FROM Contacts WHERE Account.Industry = 'media') FROM Account`,
      childBaseKey,
      queryFields,
      metadata,
    );

    expect(stateItems.querySubqueryFiltersState.Contacts.rows[0].selected).toEqual(
      expect.objectContaining({
        resource: 'Account.Industry',
        resourceGroup: nestedKey,
        value: 'media',
      }),
    );
  });

  it('detects OR as the root filter operator', () => {
    const childBaseKey = getSubqueryFieldBaseKey('Contact', 'Contacts');
    const queryFields = {
      [childBaseKey]: makeQueryFields(childBaseKey, [makeField({ name: 'Email' }), makeField({ name: 'Phone' })]),
    };
    const metadata = makeMetadataOutput('Contacts', 'Contact');

    const { stateItems } = runProcess(
      `SELECT Id, (SELECT Id FROM Contacts WHERE Email != null OR Phone != null) FROM Account`,
      childBaseKey,
      queryFields,
      metadata,
    );

    expect(stateItems.querySubqueryFiltersState.Contacts.action).toBe('OR');
    expect(stateItems.querySubqueryFiltersState.Contacts.rows).toHaveLength(2);
  });

  it('records missing filter fields under missingMisc with the Subquery prefix', () => {
    const childBaseKey = getSubqueryFieldBaseKey('Contact', 'Contacts');
    const queryFields = {
      [childBaseKey]: makeQueryFields(childBaseKey, [makeField({ name: 'Email' })]),
    };
    const metadata = makeMetadataOutput('Contacts', 'Contact');

    const { stateItems } = runProcess(
      `SELECT Id, (SELECT Id FROM Contacts WHERE NonExistentField__c = 'x' ORDER BY MissingSortField__c ASC) FROM Account`,
      childBaseKey,
      queryFields,
      metadata,
    );

    // WHERE error
    expect(stateItems.missingMisc.some((msg: string) => msg.includes("Subquery 'Contacts'"))).toBe(true);
    // No entry should be emitted when all filter rows failed
    expect(stateItems.querySubqueryFiltersState.Contacts).toBeUndefined();
    // OrderBy error message
    expect(stateItems.missingMisc.some((msg: string) => msg.includes('MissingSortField__c'))).toBe(true);
    expect(stateItems.querySubqueryOrderByState.Contacts).toBeUndefined();
  });

  it('matches parsed relationshipName to childMetadata key case-insensitively and writes state under the canonical name', () => {
    const canonicalRelationshipName = 'Contacts';
    const childBaseKey = getSubqueryFieldBaseKey('Contact', canonicalRelationshipName);
    const queryFields = {
      [childBaseKey]: makeQueryFields(childBaseKey, [makeField({ name: 'Email' })]),
    };
    const metadata = makeMetadataOutput(canonicalRelationshipName, 'Contact');

    // user-typed SOQL with different casing on the relationship name
    const { stateItems } = runProcess(
      `SELECT Id, (SELECT Id FROM contacts WHERE Email != null LIMIT 3) FROM Account`,
      childBaseKey,
      queryFields,
      metadata,
    );

    expect(stateItems.querySubqueryFiltersState[canonicalRelationshipName]).toBeDefined();
    expect(stateItems.querySubqueryLimitState[canonicalRelationshipName]).toBe('3');
    // Should NOT write under the lowercase key
    expect(stateItems.querySubqueryFiltersState['contacts']).toBeUndefined();
  });
});
