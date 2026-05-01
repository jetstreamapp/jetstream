import { describe, expect, it } from 'vitest';
import { parseCustomFieldApiNameForTooling } from '../custom-field-tooling-names';

describe('parseCustomFieldApiNameForTooling', () => {
  it('parses unmanaged custom fields (DeveloperName is API name without __c)', () => {
    expect(parseCustomFieldApiNameForTooling('Amount__c')).toEqual({
      namespacePrefix: null,
      developerName: 'Amount',
    });
    expect(parseCustomFieldApiNameForTooling('Custom_Field__c')).toEqual({
      namespacePrefix: null,
      developerName: 'Custom_Field',
    });
  });

  it('parses namespaced packaged fields into NamespacePrefix + DeveloperName', () => {
    expect(parseCustomFieldApiNameForTooling('acme__Amount__c')).toEqual({
      namespacePrefix: 'acme',
      developerName: 'Amount',
    });
    expect(parseCustomFieldApiNameForTooling('ns__My_Custom_Field__c')).toEqual({
      namespacePrefix: 'ns',
      developerName: 'My_Custom_Field',
    });
  });

  it('returns null for non-custom API names', () => {
    expect(parseCustomFieldApiNameForTooling('Name')).toBeNull();
    expect(parseCustomFieldApiNameForTooling('Lookup__r')).toBeNull();
  });
});
