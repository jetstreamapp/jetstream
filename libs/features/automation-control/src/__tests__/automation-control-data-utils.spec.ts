import { describe, expect, test } from 'vitest';
import { getDuplicateRuleFileName, getDuplicateRuleFullName } from '../automation-control-data-utils';
import { DuplicateRuleRecord } from '../automation-control-types';

const record = { SobjectType: 'Account', DeveloperName: 'Standard_Account_Duplicate_Rule' } as DuplicateRuleRecord;

describe('duplicate rule metadata naming', () => {
  test('qualifies the fullName with the object it belongs to', () => {
    // An unqualified developer name matches nothing, so the retrieve returns package.xml and no metadata.
    expect(getDuplicateRuleFullName(record)).toBe('Account.Standard_Account_Duplicate_Rule');
  });

  test('builds the duplicateRules file path from the qualified name', () => {
    expect(getDuplicateRuleFileName(record)).toBe('duplicateRules/Account.Standard_Account_Duplicate_Rule.duplicateRule');
  });
});
