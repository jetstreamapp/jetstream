import { describe, expect, it } from 'vitest';
import { getFieldUsageTypeLabel, parseFieldUsageJobResult } from './field-usage-result-parse';

describe('@jetstream/feature/data-analysis', () => {
  it('parseFieldUsageJobResult returns null for wrong phase', () => {
    expect(parseFieldUsageJobResult({ phase: 'permission_export_v1', objects: {} })).toBeNull();
    expect(parseFieldUsageJobResult(null)).toBeNull();
  });

  it('parseFieldUsageJobResult parses field_usage_v1 envelope', () => {
    const parsed = parseFieldUsageJobResult({
      phase: 'field_usage_v1',
      summary: 'ok',
      truncated: false,
      failedObjects: [],
      whereUsed: {
        'Custom__c.Field__c': [{ type: 'Flow', name: 'My_Flow', kind: 'automation' }],
      },
      objects: {
        Custom__c: {
          label: 'Custom',
          customizable: true,
          totalRecords: 10,
          queryTruncated: false,
          fieldUsage: {
            Field__c: { filled: 2, pct: 20, latestFilledRowModified: null },
          },
          fieldMeta: {
            Field__c: { label: 'Field', calculated: false, type: 'string', custom: true, length: 255 },
          },
        },
      },
    });
    expect(parsed).not.toBeNull();
    expect(parsed?.phase).toBe('field_usage_v1');
    expect(parsed?.objects.Custom__c.fieldUsage.Field__c.pct).toBe(20);
    expect(parsed?.whereUsed['Custom__c.Field__c']).toHaveLength(1);
    expect(parsed?.whereUsed['Custom__c.Field__c'][0].kind).toBe('automation');
  });

  it('getFieldUsageTypeLabel capitalizes API type when describe metadata is absent (legacy jobs)', () => {
    expect(
      getFieldUsageTypeLabel({
        label: 'Status',
        calculated: false,
        type: 'picklist',
        custom: true,
      }),
    ).toBe('Picklist');
    expect(
      getFieldUsageTypeLabel({
        label: 'Qty',
        calculated: false,
        type: 'int',
        custom: true,
      }),
    ).toBe('Number');
    expect(
      getFieldUsageTypeLabel({
        label: 'Amt',
        calculated: false,
        type: 'double',
        custom: true,
      }),
    ).toBe('Number');
  });

  it('getFieldUsageTypeLabel uses polyfill-style labels when describe metadata is present', () => {
    expect(
      getFieldUsageTypeLabel({
        label: 'Amount',
        calculated: false,
        type: 'currency',
        custom: true,
        precision: 18,
        scale: 2,
      }),
    ).toBe('Currency (18, 2)');
    expect(
      getFieldUsageTypeLabel({
        label: 'Acct',
        calculated: false,
        type: 'reference',
        custom: false,
        referenceTo: ['Account'],
        relationshipName: 'Account__r',
      }),
    ).toBe('Reference (Account)');
    expect(
      getFieldUsageTypeLabel({
        label: 'Notes',
        calculated: false,
        type: 'textarea',
        custom: true,
        length: 32768,
      }),
    ).toBe('Long Text Area (32768)');
    expect(
      getFieldUsageTypeLabel({
        label: 'Case Number',
        calculated: false,
        type: 'string',
        custom: false,
        autoNumber: true,
        length: 30,
        displayFormat: 'CS-{000000}',
      }),
    ).toBe('Auto Number (CS-{000000})');
    expect(
      getFieldUsageTypeLabel({
        label: 'Seq',
        calculated: false,
        type: 'string',
        custom: true,
        autoNumber: true,
        length: 10,
        digits: 9,
      }),
    ).toBe('Auto Number (9 digits max)');
  });
});
