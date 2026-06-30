import { SFDC_BULK_API_NULL_VALUE } from '@jetstream/shared/constants';
import { MetadataRowConfiguration } from '@jetstream/ui-core';
import { describe, expect, test } from 'vitest';
import { buildProposedChanges, formatProposedValue } from '../bulk-update-preview.utils';

type ConfigInput = {
  selectedField: string;
  type?: string;
  option?: MetadataRowConfiguration['transformationOptions']['option'];
  staticValue?: string;
  alternateField?: string;
  criteria?: MetadataRowConfiguration['transformationOptions']['criteria'];
};

function buildConfig(input: ConfigInput): MetadataRowConfiguration {
  return {
    selectedField: input.selectedField,
    selectedFieldMetadata: { type: input.type ?? 'string' } as any,
    transformationOptions: {
      option: input.option ?? 'staticValue',
      staticValue: input.staticValue ?? '',
      alternateField: input.alternateField,
      criteria: input.criteria ?? 'all',
      whereClause: '',
    },
  };
}

function findChange(record: { changes: any[] }, field: string) {
  return record.changes.find((change) => change.field === field);
}

describe('buildProposedChanges', () => {
  test('criteria "all" marks every record as impacted with the new value', () => {
    const records = [
      { Id: '1', Name: 'A' },
      { Id: '2', Name: 'B' },
    ];
    const result = buildProposedChanges(records, [buildConfig({ selectedField: 'Name', staticValue: 'New' })]);

    expect(result.fields).toEqual(['Name']);
    expect(result.impactedRecordIds).toEqual(['1', '2']);
    expect(findChange(result.records[0], 'Name')).toEqual({ field: 'Name', currentValue: 'A', newValue: 'New', willChange: true });
    expect(findChange(result.records[1], 'Name')).toEqual({ field: 'Name', currentValue: 'B', newValue: 'New', willChange: true });
  });

  test('criteria "onlyIfBlank" only impacts records whose field is blank', () => {
    const records = [
      { Id: '1', Name: null },
      { Id: '2', Name: 'B' },
    ];
    const result = buildProposedChanges(records, [buildConfig({ selectedField: 'Name', staticValue: 'New', criteria: 'onlyIfBlank' })]);

    expect(result.impactedRecordIds).toEqual(['1']);
    expect(findChange(result.records[0], 'Name')).toEqual({ field: 'Name', currentValue: null, newValue: 'New', willChange: true });
  });

  test('criteria "onlyIfNotBlank" only impacts records whose field has a value', () => {
    const records = [
      { Id: '1', Name: null },
      { Id: '2', Name: 'B' },
    ];
    const result = buildProposedChanges(records, [buildConfig({ selectedField: 'Name', staticValue: 'New', criteria: 'onlyIfNotBlank' })]);

    expect(result.impactedRecordIds).toEqual(['2']);
    expect(findChange(result.records[0], 'Name')?.currentValue).toBe('B');
  });

  test('"Clear field value" sets the new value to the Bulk API null token', () => {
    const records = [{ Id: '1', Description: 'has text' }];
    const result = buildProposedChanges(records, [buildConfig({ selectedField: 'Description', option: 'null' })]);

    expect(result.impactedRecordIds).toEqual(['1']);
    expect(findChange(result.records[0], 'Description')).toEqual({
      field: 'Description',
      currentValue: 'has text',
      newValue: SFDC_BULK_API_NULL_VALUE,
      willChange: true,
    });
  });

  test('"Value from different field" copies the alternate field value', () => {
    const records = [{ Id: '1', Name: 'A', Nickname: 'Al' }];
    const result = buildProposedChanges(records, [
      buildConfig({ selectedField: 'Name', option: 'anotherField', alternateField: 'Nickname' }),
    ]);

    expect(findChange(result.records[0], 'Name')).toEqual({ field: 'Name', currentValue: 'A', newValue: 'Al', willChange: true });
  });

  test('multi-field config with mixed criteria represents every configured field', () => {
    const records = [
      { Id: '1', Stage: 'Open', Amount: null },
      { Id: '2', Stage: 'Open', Amount: 5 },
    ];
    const result = buildProposedChanges(records, [
      buildConfig({ selectedField: 'Stage', staticValue: 'Closed', criteria: 'all' }),
      buildConfig({ selectedField: 'Amount', type: 'currency', staticValue: '10', criteria: 'onlyIfBlank' }),
    ]);

    expect(result.fields).toEqual(['Stage', 'Amount']);
    expect(result.impactedRecordIds).toEqual(['1', '2']);

    // Record 1: both fields change (Stage via "all", Amount because it is blank)
    expect(findChange(result.records[0], 'Stage')?.willChange).toBe(true);
    expect(findChange(result.records[0], 'Amount')).toEqual({ field: 'Amount', currentValue: null, newValue: '10', willChange: true });

    // Record 2: impacted via Stage; Amount is not blank so it is unchanged but still represented
    expect(findChange(result.records[1], 'Stage')?.willChange).toBe(true);
    expect(findChange(result.records[1], 'Amount')).toEqual({ field: 'Amount', currentValue: 5, newValue: 5, willChange: false });
  });

  test('"Update record without changes" touches a record even when the field is null and nothing changes', () => {
    const records = [{ Id: '1', Status: null }];
    const result = buildProposedChanges(records, [buildConfig({ selectedField: 'Status', option: 'update' })]);

    expect(result.impactedRecordIds).toEqual(['1']);
    expect(findChange(result.records[0], 'Status')).toEqual({ field: 'Status', currentValue: null, newValue: null, willChange: false });
  });

  test('records that match no criteria are excluded entirely', () => {
    const records = [{ Id: '1', Name: 'B' }];
    const result = buildProposedChanges(records, [buildConfig({ selectedField: 'Name', staticValue: 'New', criteria: 'onlyIfBlank' })]);

    expect(result.records).toHaveLength(0);
    expect(result.impactedRecordIds).toEqual([]);
  });

  // The same field can be configured in more than one row. prepareRecords applies configs in order and
  // the LAST config wins, so the preview must follow the same last-config-wins ordering to stay accurate.
  test('duplicated field: a later not-met config un-touches the field (matches prepareRecords last-config-wins)', () => {
    const records = [{ Id: '1', Name: 'A' }];
    // First config would set Name, but the second config's criteria is not met (Name is not blank), so
    // prepareRecords nulls it back out and the record is not committed — the preview must agree.
    const result = buildProposedChanges(records, [
      buildConfig({ selectedField: 'Name', staticValue: 'New', criteria: 'all' }),
      buildConfig({ selectedField: 'Name', staticValue: 'New', criteria: 'onlyIfBlank' }),
    ]);

    expect(result.records).toHaveLength(0);
    expect(result.impactedRecordIds).toEqual([]);
  });

  test('duplicated field: a later met config wins over an earlier not-met config', () => {
    const records = [{ Id: '1', Name: 'A' }];
    // First config is not met (Name is not blank), but the second config applies to all records, so the
    // last config wins and the field changes.
    const result = buildProposedChanges(records, [
      buildConfig({ selectedField: 'Name', staticValue: 'New', criteria: 'onlyIfBlank' }),
      buildConfig({ selectedField: 'Name', staticValue: 'New', criteria: 'all' }),
    ]);

    expect(result.impactedRecordIds).toEqual(['1']);
    expect(findChange(result.records[0], 'Name')).toEqual({ field: 'Name', currentValue: 'A', newValue: 'New', willChange: true });
  });
});

describe('formatProposedValue', () => {
  test('formats the Bulk API null token as "(cleared)"', () => {
    expect(formatProposedValue(SFDC_BULK_API_NULL_VALUE)).toBe('(cleared)');
  });

  test('formats nil and empty values as an empty string', () => {
    expect(formatProposedValue(null)).toBe('');
    expect(formatProposedValue(undefined)).toBe('');
    expect(formatProposedValue('')).toBe('');
  });

  test('formats booleans and primitives as readable text', () => {
    expect(formatProposedValue(true)).toBe('true');
    expect(formatProposedValue(false)).toBe('false');
    expect(formatProposedValue(5)).toBe('5');
    expect(formatProposedValue('hello')).toBe('hello');
  });
});
