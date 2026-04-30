import { describe, expect, it } from 'vitest';
import { formatIdsForInClause, isValidSalesforceId, uniqueSalesforceIds } from '../salesforce-soql';

describe('salesforce-soql', () => {
  it('validates 15- and 18-character Salesforce ids', () => {
    expect(isValidSalesforceId('00e000000000001')).toBe(true);
    expect(isValidSalesforceId('00e000000000001AAA')).toBe(true);
    expect(isValidSalesforceId('bad')).toBe(false);
  });

  it('uniqueSalesforceIds filters invalid and duplicates', () => {
    expect(uniqueSalesforceIds(['00e000000000001', '00e000000000001', '', 'nope', '00e000000000002'])).toEqual([
      '00e000000000001',
      '00e000000000002',
    ]);
  });

  it('formatIdsForInClause quotes ids', () => {
    expect(formatIdsForInClause(['00e000000000001', '00e000000000002'])).toBe("'00e000000000001','00e000000000002'");
  });
});
