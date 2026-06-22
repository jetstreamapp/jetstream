import { describe, expect, it } from 'vitest';
import { isValidSalesforceId, sanitizeSobjectApiNames, uniqueSalesforceIds } from '../sobject-api-name-utils';

describe('sobject-api-name-utils', () => {
  it('validates 15- and 18-character Salesforce ids', () => {
    expect(isValidSalesforceId('00e000000000001')).toBe(true);
    expect(isValidSalesforceId('00e000000000001AAA')).toBe(true);
    expect(isValidSalesforceId('bad')).toBe(false);
    // 16- and 17-char are not valid Salesforce ids
    expect(isValidSalesforceId('00e0000000000001')).toBe(false);
    expect(isValidSalesforceId('00e00000000000001')).toBe(false);
  });

  it('uniqueSalesforceIds filters invalid and duplicates', () => {
    expect(uniqueSalesforceIds(['00e000000000001', '00e000000000001', '', 'nope', '00e000000000002'])).toEqual([
      '00e000000000001',
      '00e000000000002',
    ]);
  });

  it('sanitizeSobjectApiNames filters invalid and dedupes', () => {
    expect(sanitizeSobjectApiNames(['Account', ' Account ', 'Account', 'bad name', '', 12, 'ns__Obj__c'])).toEqual([
      'Account',
      'ns__Obj__c',
    ]);
  });

  it('sanitizeSobjectApiNames returns empty for non-array', () => {
    expect(sanitizeSobjectApiNames(null)).toEqual([]);
  });

  it('sanitizeSobjectApiNames rejects names with SOQL injection characters', () => {
    expect(sanitizeSobjectApiNames(["Account', 'Contact", 'Account); --', 'Account/*', "Account'"])).toEqual([]);
  });

  it('sanitizeSobjectApiNames caps the list length', () => {
    const input = Array.from({ length: 600 }, (_, i) => `Obj${i}__c`);
    expect(sanitizeSobjectApiNames(input).length).toBe(500);
  });
});
