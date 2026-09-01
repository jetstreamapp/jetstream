import { describe, expect, test } from 'vitest';
import { getDeploymentItemErrorMessage, getDuplicateRuleFileName, getDuplicateRuleFullName } from '../automation-control-data-utils';
import { AutomationControlDeploymentItem, DuplicateRuleRecord } from '../automation-control-types';

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

describe('getDeploymentItemErrorMessage', () => {
  function buildDeploy(overrides: Partial<AutomationControlDeploymentItem> = {}): AutomationControlDeploymentItem {
    return {
      type: 'ValidationRule',
      id: '000000000000000001',
      activeVersionNumber: null,
      value: true,
      requireMetadataApi: false,
      metadataRetrieve: null,
      metadataDeploy: null,
      retrieveError: null,
      deployError: null,
      ...overrides,
    };
  }

  test('returns undefined for rows that are not in an error state', () => {
    expect(
      getDeploymentItemErrorMessage({
        status: 'Deployed',
        deploy: buildDeploy({ deployError: [{ errorCode: 'X', message: 'should not surface' }] }),
      }),
    ).toBeUndefined();
  });

  test('joins deploy error messages', () => {
    expect(
      getDeploymentItemErrorMessage({
        status: 'Error',
        deploy: buildDeploy({
          deployError: [
            { errorCode: 'FIELD_INTEGRITY_EXCEPTION', message: 'First problem' },
            { errorCode: 'UNKNOWN', message: 'Second problem' },
          ],
        }),
      }),
    ).toBe('First problem\n\nSecond problem');
  });

  test('falls back to retrieve errors when there is no deploy error', () => {
    expect(
      getDeploymentItemErrorMessage({
        status: 'Error',
        deploy: buildDeploy({ retrieveError: [{ errorCode: 'NOT_FOUND', message: 'Metadata could not be retrieved' }] }),
      }),
    ).toBe('Metadata could not be retrieved');
  });

  test('returns a generic message when the row errored without error details', () => {
    expect(getDeploymentItemErrorMessage({ status: 'Error', deploy: buildDeploy() })).toBe('An unknown error has occurred');
  });
});
