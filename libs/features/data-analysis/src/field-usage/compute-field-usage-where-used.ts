import { queryAll } from '@jetstream/shared/data';
import { logger } from '@jetstream/shared/client-logger';
import {
  dedupeFieldUsageWhereUsedRows,
  parseCustomFieldApiNameForTooling,
  sortFieldUsageWhereUsedRows,
  splitArrayToMaxSize,
} from '@jetstream/shared/utils';
import type { FieldUsageJobResultData, SalesforceOrgUi } from '@jetstream/types';
import { composeQuery, getField } from '@jetstreamapp/soql-parser-js';
import type { FieldUsageObjectPayload } from './run-field-usage';

const WHERE_USED_AUTOMATION_TYPES = new Set([
  'ApexTrigger',
  'Flow',
  'FlowDefinition',
  'WorkflowFieldUpdate',
  'WorkflowRule',
  'ProcessDefinition',
]);

/** Apex code / Visualforce metadata (not triggers — those stay in the automation bucket). */
const WHERE_USED_APEX_TYPES = new Set(['ApexClass', 'ApexPage', 'ApexComponent']);

/** Page UI metadata — On layout bucket (classic layout, Lightning page, field sets on layouts). */
const WHERE_USED_LAYOUT_TYPES = new Set(['Layout', 'FlexiPage', 'FieldSet']);

/** Batch size for the (object, developerName) tuples per Tooling CustomField lookup. */
const CUSTOM_FIELD_LOOKUP_CHUNK_SIZE = 200;

/** Concurrency for per-field `MetadataComponentDependency` lookups. */
const DEPENDENCY_LOOKUP_CONCURRENCY = 5;

/** Chunk size for Flow Id `IN (...)` filters during enrichment. */
const FLOW_ID_CHUNK_SIZE = 200;

export type WhereUsedDependencyRow = {
  type: string;
  name: string;
  kind: 'automation' | 'apex' | 'layout' | 'other';
  /** Tooling `MetadataComponentDependency.MetadataComponentId` when returned. */
  componentId?: string;
  /** Populated for `Flow` rows when Tooling `Flow` can be resolved (same dependency row as a specific version). */
  flowVersionNumber?: number | null;
  /**
   * Relative path in the org (leading `/`) to open this component (Flow Builder, Apex setup, etc.).
   * Omitted when unknown; clients may fall back from {@link componentId} + {@link type}.
   */
  openInSalesforcePath?: string | null;
};

export type WhereUsedMap = Record<string, WhereUsedDependencyRow[]>;

function depKind(componentType: string): WhereUsedDependencyRow['kind'] {
  if (WHERE_USED_AUTOMATION_TYPES.has(componentType)) {
    return 'automation';
  }
  if (WHERE_USED_APEX_TYPES.has(componentType)) {
    return 'apex';
  }
  if (WHERE_USED_LAYOUT_TYPES.has(componentType)) {
    return 'layout';
  }
  return 'other';
}

/**
 * Fills {@link WhereUsedDependencyRow.flowVersionNumber}, {@link WhereUsedDependencyRow.openInSalesforcePath}
 * for Flow rows via Tooling `Flow` (`Id` + `VersionNumber` only — not `DurableId`, which is not on Tooling `Flow`),
 * and generic setup paths when we have a `MetadataComponentId`.
 */
async function enrichWhereUsedDependencyRows(org: SalesforceOrgUi, rows: WhereUsedDependencyRow[]): Promise<void> {
  const flowIds = new Set<string>();
  for (const row of rows) {
    if (row.type === 'Flow' && row.componentId) {
      flowIds.add(row.componentId);
    }
  }
  const flowVersionById = new Map<string, { versionNumber: number }>();
  if (flowIds.size > 0) {
    for (const idChunk of splitArrayToMaxSize([...flowIds], FLOW_ID_CHUNK_SIZE)) {
      const soql = composeQuery({
        fields: [getField('Id'), getField('VersionNumber')],
        sObject: 'Flow',
        where: {
          left: {
            field: 'Id',
            operator: 'IN',
            value: idChunk,
            literalType: 'STRING',
          },
        },
      });
      const records = (await queryAll<Record<string, unknown>>(org, soql, true)).queryResults.records;
      for (const record of records) {
        const id = record.Id != null ? String(record.Id) : '';
        if (!id) {
          continue;
        }
        const versionRaw = record.VersionNumber;
        const versionNumber = typeof versionRaw === 'number' ? versionRaw : Number(versionRaw);
        flowVersionById.set(id, {
          versionNumber: Number.isFinite(versionNumber) ? versionNumber : 0,
        });
      }
    }
  }

  for (const row of rows) {
    const componentType = row.type;
    const componentId = row.componentId;
    if (componentType === 'Flow' && componentId) {
      const info = flowVersionById.get(componentId);
      if (info) {
        row.flowVersionNumber = info.versionNumber;
        row.openInSalesforcePath = `/builder_platform_interaction/flowBuilder.app?flowId=${encodeURIComponent(componentId)}`;
        continue;
      }
    }
    if (row.openInSalesforcePath) {
      continue;
    }
    if (componentType === 'ProcessDefinition') {
      row.openInSalesforcePath = '/lightning/setup/ProcessAutomation/home';
      continue;
    }
    if (!componentId) {
      continue;
    }
    if (componentType === 'ApexClass') {
      row.openInSalesforcePath = `/lightning/setup/ApexClasses/page?address=${encodeURIComponent(encodeURIComponent(`/${componentId}`))}`;
    } else if (componentType === 'ApexTrigger') {
      row.openInSalesforcePath = `/lightning/setup/ApexTriggers/page?address=${encodeURIComponent(encodeURIComponent(`/${componentId}`))}`;
    } else if (componentType === 'ApexPage') {
      row.openInSalesforcePath = `/lightning/setup/ApexPages/page?address=${encodeURIComponent(encodeURIComponent(`/${componentId}`))}`;
    } else if (componentType === 'ApexComponent') {
      row.openInSalesforcePath = `/lightning/setup/ApexComponents/page?address=${encodeURIComponent(encodeURIComponent(`/${componentId}`))}`;
    } else if (componentType === 'FlexiPage') {
      row.openInSalesforcePath = `/lightning/setup/FlexiPageList/page?address=${encodeURIComponent(encodeURIComponent(`/${componentId}`))}`;
    } else if (componentType === 'Layout') {
      row.openInSalesforcePath = `/lightning/setup/LayoutDefinitions/page?address=${encodeURIComponent(encodeURIComponent(`/${componentId}`))}`;
    } else if (componentType === 'FieldSet') {
      row.openInSalesforcePath = `/lightning/setup/FieldSets/page?address=${encodeURIComponent(encodeURIComponent(`/${componentId}`))}`;
    } else if (componentType === 'WorkflowRule' || componentType === 'WorkflowFieldUpdate') {
      row.openInSalesforcePath = `/lightning/setup/WorkflowRules/page?address=${encodeURIComponent(encodeURIComponent(`/${componentId}`))}`;
    }
  }
}

interface ParsedFieldRef {
  key: string;
  object: string;
  field: string;
  developerName: string;
  namespacePrefix: string | null;
}

function namespaceMatches(rowNamespacePrefix: unknown, expected: string | null): boolean {
  const rowValue = typeof rowNamespacePrefix === 'string' ? rowNamespacePrefix : '';
  if (expected == null || expected.length === 0) {
    return rowValue.length === 0;
  }
  return rowValue === expected;
}

/**
 * Batches Tooling `CustomField` lookups by (object, developerName) tuples.
 * Returns a map keyed by `${object}.${field}` → Tooling CustomField Id.
 * Tries `EntityDefinition.QualifiedApiName` first, then falls back to `TableEnumOrId` for any unresolved fields.
 */
async function resolveCustomFieldIds(org: SalesforceOrgUi, refs: { object: string; field: string }[]): Promise<Map<string, string>> {
  const parsedRefs: ParsedFieldRef[] = [];
  for (const ref of refs) {
    const parsed = parseCustomFieldApiNameForTooling(ref.field);
    if (!ref.object || !parsed) {
      continue;
    }
    parsedRefs.push({
      key: `${ref.object}.${ref.field}`,
      object: ref.object,
      field: ref.field,
      developerName: parsed.developerName,
      namespacePrefix: parsed.namespacePrefix,
    });
  }
  if (parsedRefs.length === 0) {
    return new Map();
  }

  const resolved = new Map<string, string>();
  const unresolved = new Map<string, ParsedFieldRef>();
  for (const ref of parsedRefs) {
    unresolved.set(ref.key, ref);
  }

  async function runLookup(filterField: 'EntityDefinition.QualifiedApiName' | 'TableEnumOrId'): Promise<void> {
    const pending = [...unresolved.values()];
    if (pending.length === 0) {
      return;
    }
    for (const chunk of splitArrayToMaxSize(pending, CUSTOM_FIELD_LOOKUP_CHUNK_SIZE)) {
      const objectNames = [...new Set(chunk.map((ref) => ref.object))];
      const developerNames = [...new Set(chunk.map((ref) => ref.developerName))];
      const soql = composeQuery({
        fields: [
          getField('Id'),
          getField('EntityDefinition.QualifiedApiName'),
          getField('TableEnumOrId'),
          getField('DeveloperName'),
          getField('NamespacePrefix'),
        ],
        sObject: 'CustomField',
        where: {
          left: {
            field: filterField,
            operator: 'IN',
            value: objectNames,
            literalType: 'STRING',
          },
          operator: 'AND',
          right: {
            left: {
              field: 'DeveloperName',
              operator: 'IN',
              value: developerNames,
              literalType: 'STRING',
            },
          },
        },
      });

      let records: Record<string, unknown>[] = [];
      try {
        records = (await queryAll<Record<string, unknown>>(org, soql, true)).queryResults.records;
      } catch (err) {
        logger.warn('CustomField batch lookup failed; skipping chunk', { err, filterField });
        continue;
      }

      const byObjectAndDevName = new Map<string, Record<string, unknown>[]>();
      for (const record of records) {
        let objectName = '';
        if (filterField === 'EntityDefinition.QualifiedApiName') {
          const entity = record.EntityDefinition;
          if (entity && typeof entity === 'object') {
            const qualifiedApiName = (entity as { QualifiedApiName?: unknown }).QualifiedApiName;
            objectName = typeof qualifiedApiName === 'string' ? qualifiedApiName : '';
          }
        } else {
          objectName = typeof record.TableEnumOrId === 'string' ? record.TableEnumOrId : '';
        }
        const developerName = typeof record.DeveloperName === 'string' ? record.DeveloperName : '';
        if (!objectName || !developerName) {
          continue;
        }
        const bucketKey = `${objectName}.${developerName}`;
        let bucket = byObjectAndDevName.get(bucketKey);
        if (!bucket) {
          bucket = [];
          byObjectAndDevName.set(bucketKey, bucket);
        }
        bucket.push(record);
      }

      for (const ref of chunk) {
        if (resolved.has(ref.key)) {
          continue;
        }
        const bucket = byObjectAndDevName.get(`${ref.object}.${ref.developerName}`);
        if (!bucket) {
          continue;
        }
        const match = bucket.find((rec) => namespaceMatches(rec.NamespacePrefix, ref.namespacePrefix));
        if (match && typeof match.Id === 'string') {
          resolved.set(ref.key, match.Id);
          unresolved.delete(ref.key);
        }
      }
    }
  }

  await runLookup('EntityDefinition.QualifiedApiName');
  if (unresolved.size > 0) {
    await runLookup('TableEnumOrId');
  }

  return resolved;
}

async function getFieldDependencies(org: SalesforceOrgUi, refComponentId: string): Promise<WhereUsedDependencyRow[]> {
  const soql = composeQuery({
    fields: [getField('MetadataComponentId'), getField('MetadataComponentType'), getField('MetadataComponentName')],
    sObject: 'MetadataComponentDependency',
    where: {
      left: {
        field: 'RefMetadataComponentId',
        operator: '=',
        value: refComponentId,
        literalType: 'STRING',
      },
      operator: 'AND',
      right: {
        left: {
          field: 'RefMetadataComponentType',
          operator: '=',
          value: 'CustomField',
          literalType: 'STRING',
        },
      },
    },
  });
  const records = (await queryAll<Record<string, unknown>>(org, soql, true)).queryResults.records;
  const dependencyRows: WhereUsedDependencyRow[] = [];
  for (const record of records) {
    const componentType = record.MetadataComponentType != null ? String(record.MetadataComponentType) : '';
    const componentName = record.MetadataComponentName != null ? String(record.MetadataComponentName) : '';
    if (!componentType && !componentName) {
      continue;
    }
    const componentIdRaw = record.MetadataComponentId;
    const componentId = typeof componentIdRaw === 'string' ? componentIdRaw : '';
    dependencyRows.push({
      type: componentType,
      name: componentName,
      kind: depKind(componentType),
      ...(componentId ? { componentId } : {}),
    });
  }
  return dependencyRows;
}

async function runWithConcurrency<TItem, TResult>(
  items: TItem[],
  concurrency: number,
  handler: (item: TItem) => Promise<TResult>,
): Promise<TResult[]> {
  const results: TResult[] = new Array(items.length);
  const cursor = { next: 0 };
  const worker = async (): Promise<void> => {
    while (true) {
      const currentIndex = cursor.next;
      cursor.next += 1;
      if (currentIndex >= items.length) {
        return;
      }
      results[currentIndex] = await handler(items[currentIndex]);
    }
  };
  const workerCount = Math.min(concurrency, items.length);
  const workers: Promise<void>[] = [];
  for (let workerIndex = 0; workerIndex < workerCount; workerIndex++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

function collectCustomFieldKeys(objects: Record<string, FieldUsageObjectPayload>): { object: string; field: string }[] {
  const refs: { object: string; field: string }[] = [];
  for (const objectName of Object.keys(objects).sort()) {
    const payload = objects[objectName];
    if (!payload || payload.error) {
      continue;
    }
    for (const fieldName of Object.keys(payload.fieldUsage)) {
      if (fieldName.endsWith('__c')) {
        refs.push({ object: objectName, field: fieldName });
      }
    }
  }
  return refs;
}

/**
 * Tooling MetadataComponentDependency map keyed `ObjectApi.FieldApi` (custom fields only).
 *
 * Resolves all CustomField Ids in batched Tooling queries, then fetches dependency rows
 * with bounded concurrency. Flow enrichment runs once across the union of all rows.
 */
export async function computeFieldUsageWhereUsed(
  org: SalesforceOrgUi,
  objects: Record<string, FieldUsageObjectPayload>,
): Promise<FieldUsageJobResultData['whereUsed']> {
  const refs = collectCustomFieldKeys(objects);
  const results: WhereUsedMap = {};
  for (const ref of refs) {
    results[`${ref.object}.${ref.field}`] = [];
  }
  if (refs.length === 0) {
    return results as FieldUsageJobResultData['whereUsed'];
  }

  const fieldIdByKey = await resolveCustomFieldIds(org, refs);
  const resolvedEntries = [...fieldIdByKey.entries()];

  const dependencyRowsByKey = await runWithConcurrency(resolvedEntries, DEPENDENCY_LOOKUP_CONCURRENCY, async ([key, fieldId]) => {
    try {
      const rows = await getFieldDependencies(org, fieldId);
      return { key, rows };
    } catch (err) {
      logger.warn('field usage where-used dependency lookup failed; returning empty rows', { err, key });
      return { key, rows: [] as WhereUsedDependencyRow[] };
    }
  });

  const allRows: WhereUsedDependencyRow[] = [];
  for (const { rows } of dependencyRowsByKey) {
    allRows.push(...rows);
  }
  try {
    await enrichWhereUsedDependencyRows(org, allRows);
  } catch (err) {
    logger.warn('field usage where-used enrichment failed; returning dependency rows without paths/versions', { err });
  }

  for (const { key, rows } of dependencyRowsByKey) {
    results[key] = sortFieldUsageWhereUsedRows(dedupeFieldUsageWhereUsedRows(rows));
  }

  return results as FieldUsageJobResultData['whereUsed'];
}
