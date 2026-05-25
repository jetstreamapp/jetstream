import { describe, expect, it } from 'vitest';
import {
  customFieldApiNameHasNamespacePrefix,
  isCustomFieldApiName,
  isUnmanagedCustomFieldApiName,
  parseCustomFieldApiNameForTooling,
} from '../custom-field-tooling-names';

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

describe('isCustomFieldApiName', () => {
  it('is true for custom field API names parseable for Tooling', () => {
    expect(isCustomFieldApiName('Amount__c')).toBe(true);
    expect(isCustomFieldApiName('acme__Amount__c')).toBe(true);
  });

  it('is false for standard and relationship suffixes', () => {
    expect(isCustomFieldApiName('Name')).toBe(false);
    expect(isCustomFieldApiName('Lookup__r')).toBe(false);
  });
});

describe('isUnmanagedCustomFieldApiName', () => {
  it('is true only when there is no namespace prefix', () => {
    expect(isUnmanagedCustomFieldApiName('Amount__c')).toBe(true);
    expect(isUnmanagedCustomFieldApiName('My_Field__c')).toBe(true);
    expect(isUnmanagedCustomFieldApiName('acme__Amount__c')).toBe(false);
    expect(isUnmanagedCustomFieldApiName('Name')).toBe(false);
  });
});

describe('customFieldApiNameHasNamespacePrefix', () => {
  it('is false for unmanaged custom fields', () => {
    expect(customFieldApiNameHasNamespacePrefix('Amount__c')).toBe(false);
    expect(customFieldApiNameHasNamespacePrefix('My_Field__c')).toBe(false);
  });

  it('is true for namespaced packaged custom fields', () => {
    expect(customFieldApiNameHasNamespacePrefix('acme__Amount__c')).toBe(true);
    expect(customFieldApiNameHasNamespacePrefix('ns__My_Custom_Field__c')).toBe(true);
  });

  it('is false for non-custom API names', () => {
    expect(customFieldApiNameHasNamespacePrefix('Name')).toBe(false);
  });
});
