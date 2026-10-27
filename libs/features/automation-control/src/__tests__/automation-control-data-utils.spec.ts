import { describe, expect, test } from 'vitest';
import { getAutomationFullName, getDuplicateRuleFileName, getDuplicateRuleFullName } from '../automation-control-data-utils';
import { DuplicateRuleRecord, FlowViewRecord } from '../automation-control-types';

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

describe('getAutomationFullName', () => {
  test('qualifies a namespaced flow, which the Metadata API cannot find by its plain api name', () => {
    expect(getAutomationFullName('FlowRecordTriggered', { ApiName: 'My_Flow', NamespacePrefix: 'test_ns' } as FlowViewRecord)).toBe(
      'test_ns__My_Flow',
    );
    expect(getAutomationFullName('FlowProcessBuilder', { ApiName: 'My_Flow', NamespacePrefix: null } as FlowViewRecord)).toBe('My_Flow');
  });

  test('qualifies a duplicate rule with its object', () => {
    expect(getAutomationFullName('DuplicateRule', record)).toBe('Account.Standard_Account_Duplicate_Rule');
  });
});
