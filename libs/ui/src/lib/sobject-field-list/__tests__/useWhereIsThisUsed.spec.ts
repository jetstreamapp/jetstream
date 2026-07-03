import { describe, expect, it } from 'vitest';
import { getEntityDefinitionQuery } from '../useWhereIsThisUsed';

describe('getEntityDefinitionQuery', () => {
  it('queries by DeveloperName with a null namespace for unmanaged custom fields', () => {
    const soql = getEntityDefinitionQuery('Account', 'Amount__c');
    expect(soql).toContain(`EntityDefinition.QualifiedApiName = 'Account'`);
    expect(soql).toContain(`DeveloperName = 'Amount'`);
    expect(soql).toContain(`NamespacePrefix = null`);
  });

  it('queries by DeveloperName and NamespacePrefix for managed package fields', () => {
    const soql = getEntityDefinitionQuery('Account', 'acme__Amount__c');
    expect(soql).toContain(`DeveloperName = 'Amount'`);
    expect(soql).toContain(`NamespacePrefix = 'acme'`);
  });

  it('returns a no-result query for non-custom field API names', () => {
    expect(getEntityDefinitionQuery('Account', 'Name')).toContain('WHERE Id = NULL');
    // Guards against callers passing a pre-stripped DeveloperName instead of the full API name
    expect(getEntityDefinitionQuery('Account', 'Amount')).toContain('WHERE Id = NULL');
  });
});
