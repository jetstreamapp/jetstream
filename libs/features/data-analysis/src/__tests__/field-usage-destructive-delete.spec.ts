import { describe, expect, it } from 'vitest';
import { fieldUsageRowEligibleForDestructiveDelete, fieldUsageRowsToCustomFieldDeleteMetadata } from '../field-usage-destructive-delete';
import type { FieldUsageFieldMetaParsed } from '../field-usage-result-parse';

const customMeta = (overrides: Partial<FieldUsageFieldMetaParsed> = {}): FieldUsageFieldMetaParsed => ({
  label: 'Test',
  calculated: false,
  type: 'string',
  custom: true,
  ...overrides,
});

describe('fieldUsageRowEligibleForDestructiveDelete', () => {
  it('rejects placeholders, non-custom, name fields, non-__c, and namespaced custom fields', () => {
    expect(
      fieldUsageRowEligibleForDestructiveDelete({
        isObjectErrorPlaceholder: true,
        fieldApiName: 'X__c',
        meta: customMeta(),
      }),
    ).toBe(false);

    expect(
      fieldUsageRowEligibleForDestructiveDelete({
        fieldApiName: 'Name',
        meta: { ...customMeta(), custom: false },
      }),
    ).toBe(false);

    expect(
      fieldUsageRowEligibleForDestructiveDelete({
        fieldApiName: 'My_Field__c',
        meta: customMeta({ nameField: true }),
      }),
    ).toBe(false);

    expect(
      fieldUsageRowEligibleForDestructiveDelete({
        fieldApiName: 'Industry',
        meta: customMeta({ custom: false }),
      }),
    ).toBe(false);

    expect(
      fieldUsageRowEligibleForDestructiveDelete({
        fieldApiName: 'ns__F__c',
        meta: customMeta(),
      }),
    ).toBe(false);
  });

  it('accepts unmanaged custom fields', () => {
    expect(
      fieldUsageRowEligibleForDestructiveDelete({
        fieldApiName: 'Unused_Field__c',
        meta: customMeta(),
      }),
    ).toBe(true);
  });

  describe('safety gates', () => {
    const eligibleArgs = { fieldApiName: 'Unused_Field__c', meta: customMeta() };

    it('blocks deletion when the object scan was truncated (0% may be incomplete)', () => {
      expect(fieldUsageRowEligibleForDestructiveDelete({ ...eligibleArgs, objectQueryTruncated: true })).toBe(false);
    });

    it('blocks deletion when the field has where-used metadata dependencies', () => {
      expect(fieldUsageRowEligibleForDestructiveDelete({ ...eligibleArgs, whereUsedDependencyCount: 1 })).toBe(false);
    });

    it('blocks deletion when where-used could not be determined (fail safe)', () => {
      expect(fieldUsageRowEligibleForDestructiveDelete({ ...eligibleArgs, whereUsedKnown: false })).toBe(false);
    });

    it('allows deletion only when scan complete, no dependencies, and where-used known', () => {
      expect(
        fieldUsageRowEligibleForDestructiveDelete({
          ...eligibleArgs,
          objectQueryTruncated: false,
          whereUsedDependencyCount: 0,
          whereUsedKnown: true,
        }),
      ).toBe(true);
    });
  });
});

describe('fieldUsageRowsToCustomFieldDeleteMetadata', () => {
  it('builds CustomField members with Object.Field fullName', () => {
    const map = fieldUsageRowsToCustomFieldDeleteMetadata([
      {
        objectApiName: 'Account',
        fieldApiName: 'Jetstream_Test_Field__c',
        destructiveDeleteEligible: true,
      },
      {
        objectApiName: 'Account',
        fieldApiName: 'Industry',
        destructiveDeleteEligible: false,
      },
    ]);
    expect(Object.keys(map)).toEqual(['CustomField']);
    expect(map.CustomField).toHaveLength(1);
    expect(map.CustomField[0].fullName).toBe('Account.Jetstream_Test_Field__c');
    expect(map.CustomField[0].type).toBe('CustomField');
  });
});
