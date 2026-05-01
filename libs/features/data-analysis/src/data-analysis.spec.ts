import { describe, expect, it } from 'vitest';
import { parseFieldUsageJobResult } from './field-usage-result-parse';

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
            Field__c: { label: 'Field', calculated: false, type: 'Text', custom: true },
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
});
