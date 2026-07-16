import { describe, expect, it } from 'vitest';
import { dedupeFieldUsageWhereUsedRows, flowLikeAutomationDedupeKey, sortFieldUsageWhereUsedRows } from '../dedupe-field-usage-where-used';

describe('dedupeFieldUsageWhereUsedRows', () => {
  it('merges Flow and FlowDefinition with the same base name', () => {
    const rows = dedupeFieldUsageWhereUsedRows([
      { type: 'Flow', name: 'My_Flow', kind: 'automation' },
      { type: 'FlowDefinition', name: 'My_Flow', kind: 'automation' },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('FlowDefinition');
    expect(rows[0].name).toBe('My_Flow');
  });

  it('merges Flow rows that only differ by a trailing version suffix', () => {
    const rows = dedupeFieldUsageWhereUsedRows([
      { type: 'Flow', name: 'My_Flow-1', kind: 'automation' },
      { type: 'Flow', name: 'My_Flow-2', kind: 'automation' },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe('Flow');
    expect(rows[0].name).toBe('My_Flow-1');
  });

  it('keeps distinct flows whose names do not normalize to the same key', () => {
    const rows = dedupeFieldUsageWhereUsedRows([
      { type: 'Flow', name: 'Alpha_Flow', kind: 'automation' },
      { type: 'Flow', name: 'Beta_Flow', kind: 'automation' },
    ]);
    expect(rows).toHaveLength(2);
  });

  it('does not merge ApexTrigger or WorkflowRule rows', () => {
    const rows = dedupeFieldUsageWhereUsedRows([
      { type: 'ApexTrigger', name: 'T1', kind: 'automation' },
      { type: 'ApexTrigger', name: 'T1', kind: 'automation' },
    ]);
    expect(rows).toHaveLength(2);
  });

  it('leaves apex, layout, and other kinds untouched', () => {
    const rows = dedupeFieldUsageWhereUsedRows([
      { type: 'Flow', name: 'F', kind: 'automation' },
      { type: 'ApexClass', name: 'C', kind: 'apex' },
      { type: 'Layout', name: 'L', kind: 'layout' },
    ]);
    expect(rows).toHaveLength(3);
  });
});

describe('flowLikeAutomationDedupeKey', () => {
  it('strips trailing -digits', () => {
    expect(flowLikeAutomationDedupeKey('X-12')).toBe('X');
    expect(flowLikeAutomationDedupeKey('My_Flow-3')).toBe('My_Flow');
  });
});

describe('sortFieldUsageWhereUsedRows', () => {
  it('orders by kind then type then name', () => {
    const sorted = sortFieldUsageWhereUsedRows([
      { type: 'Layout', name: 'Z', kind: 'layout' },
      { type: 'Flow', name: 'A', kind: 'automation' },
      { type: 'ApexClass', name: 'B', kind: 'apex' },
    ]);
    expect(sorted.map((r) => r.kind)).toEqual(['automation', 'apex', 'layout']);
  });
});
