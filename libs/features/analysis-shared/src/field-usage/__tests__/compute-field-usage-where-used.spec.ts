import type { SalesforceOrgUi } from '@jetstream/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { computeFieldUsageWhereUsed } from '../compute-field-usage-where-used';
import type { FieldUsageObjectPayload } from '../run-field-usage';

const { queryAllMock, queryAllUsingOffsetMock } = vi.hoisted(() => ({
  queryAllMock: vi.fn(),
  queryAllUsingOffsetMock: vi.fn(),
}));

vi.mock('@jetstream/shared/data', () => ({ queryAll: queryAllMock, queryAllUsingOffset: queryAllUsingOffsetMock }));
vi.mock('@jetstream/shared/client-logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const org = { uniqueId: 'org-1' } as unknown as SalesforceOrgUi;

function soqlOf(args: unknown[]): string {
  return (args.find((arg) => typeof arg === 'string') as string | undefined) ?? '';
}

function depResult(records: Record<string, unknown>[]) {
  return { queryResults: { done: true, records } };
}

function objectWithFields(fieldNames: string[]): Record<string, FieldUsageObjectPayload> {
  const fieldUsage: FieldUsageObjectPayload['fieldUsage'] = {};
  for (const name of fieldNames) {
    fieldUsage[name] = { filled: 0, pct: 0, latestFilledRowModified: null, scanned: 0, truncated: false };
  }
  return {
    Account: { label: 'Account', customizable: false, totalRecords: 0, queryTruncated: false, fieldUsage, fieldMeta: {} },
  };
}

/** CustomField resolution (and Flow enrichment) go through `queryAll`; configure which fields resolve. */
function mockCustomFieldResolution(resolved: { id: string; developerName: string }[]) {
  queryAllMock.mockImplementation(async (...args: unknown[]) => {
    const soql = soqlOf(args);
    if (soql.includes('FROM CustomField')) {
      return {
        queryResults: {
          records: resolved.map((field) => ({
            Id: field.id,
            EntityDefinition: { QualifiedApiName: 'Account' },
            DeveloperName: field.developerName,
            NamespacePrefix: null,
          })),
        },
      };
    }
    return { queryResults: { records: [] } }; // Flow enrichment, etc.
  });
}

describe('computeFieldUsageWhereUsed — batched dependency lookup', () => {
  beforeEach(() => {
    queryAllMock.mockReset();
    queryAllUsingOffsetMock.mockReset();
  });

  it('fetches dependencies for all fields in a SINGLE batched IN(...) query, not one per field', async () => {
    mockCustomFieldResolution([
      { id: 'fieldA', developerName: 'A' },
      { id: 'fieldB', developerName: 'B' },
    ]);
    queryAllUsingOffsetMock.mockResolvedValue(depResult([]));

    const result = await computeFieldUsageWhereUsed(org, objectWithFields(['A__c', 'B__c']));

    const dependencyCalls = queryAllUsingOffsetMock.mock.calls.filter((call) => soqlOf(call).includes('MetadataComponentDependency'));
    expect(dependencyCalls).toHaveLength(1);
    expect(soqlOf(dependencyCalls[0])).toContain('IN ');
    expect([...result.resolvedFieldKeys].sort()).toEqual(['Account.A__c', 'Account.B__c']);
  });

  it('groups batched rows back to each field and marks them resolved (proven-clean / with deps)', async () => {
    mockCustomFieldResolution([
      { id: 'fieldA', developerName: 'A' },
      { id: 'fieldB', developerName: 'B' },
    ]);
    queryAllUsingOffsetMock.mockResolvedValue(
      depResult([
        {
          RefMetadataComponentId: 'fieldB',
          MetadataComponentId: 'apx1',
          MetadataComponentType: 'ApexClass',
          MetadataComponentName: 'MyClass',
        },
      ]),
    );

    const result = await computeFieldUsageWhereUsed(org, objectWithFields(['A__c', 'B__c']));

    expect(result.whereUsed['Account.A__c']).toEqual([]); // proven zero deps
    expect(result.whereUsed['Account.B__c']).toHaveLength(1);
    expect(result.whereUsed['Account.B__c'][0]).toMatchObject({ type: 'ApexClass', kind: 'apex' });
    expect([...result.resolvedFieldKeys].sort()).toEqual(['Account.A__c', 'Account.B__c']);
  });

  it('splits the id list and re-queries when a batch fills the offset ceiling (more rows beyond OFFSET cap)', async () => {
    mockCustomFieldResolution([
      { id: 'fieldA', developerName: 'A' },
      { id: 'fieldB', developerName: 'B' },
    ]);
    // The combined batch returns a full page (2000) → treated as truncated → split into single-id queries.
    const fullPage = Array.from({ length: 2000 }, () => ({
      RefMetadataComponentId: 'fieldA',
      MetadataComponentType: 'Layout',
      MetadataComponentName: 'L',
    }));
    queryAllUsingOffsetMock.mockImplementation(async (...args: unknown[]) => {
      const soql = soqlOf(args);
      if (soql.includes('fieldA') && soql.includes('fieldB')) {
        return depResult(fullPage);
      }
      const refId = soql.includes('fieldA') ? 'fieldA' : 'fieldB';
      return depResult([
        { RefMetadataComponentId: refId, MetadataComponentId: 'lay1', MetadataComponentType: 'Layout', MetadataComponentName: 'L' },
      ]);
    });

    const result = await computeFieldUsageWhereUsed(org, objectWithFields(['A__c', 'B__c']));

    const dependencyCalls = queryAllUsingOffsetMock.mock.calls.filter((call) => soqlOf(call).includes('MetadataComponentDependency'));
    expect(dependencyCalls).toHaveLength(3); // 1 combined (full page) + 2 split
    expect(result.whereUsed['Account.A__c']).toHaveLength(1);
    expect(result.whereUsed['Account.B__c']).toHaveLength(1);
    expect([...result.resolvedFieldKeys].sort()).toEqual(['Account.A__c', 'Account.B__c']);
  });

  it('marks all batched fields UNKNOWN (not resolved) when the dependency query fails', async () => {
    mockCustomFieldResolution([
      { id: 'fieldA', developerName: 'A' },
      { id: 'fieldB', developerName: 'B' },
    ]);
    queryAllUsingOffsetMock.mockRejectedValue(new Error('transient API limit'));

    const result = await computeFieldUsageWhereUsed(org, objectWithFields(['A__c', 'B__c']));

    expect(result.resolvedFieldKeys).toEqual([]); // both UNKNOWN → never delete-eligible
    expect(result.whereUsed['Account.A__c']).toEqual([]);
    expect(result.whereUsed['Account.B__c']).toEqual([]);
  });

  it('does not resolve a field whose Tooling Id never resolved', async () => {
    mockCustomFieldResolution([{ id: 'fieldA', developerName: 'A' }]); // B never resolves
    queryAllUsingOffsetMock.mockResolvedValue(depResult([]));

    const result = await computeFieldUsageWhereUsed(org, objectWithFields(['A__c', 'B__c']));

    expect(result.resolvedFieldKeys).toEqual(['Account.A__c']);
    expect(result.whereUsed['Account.B__c']).toEqual([]);
  });
});
