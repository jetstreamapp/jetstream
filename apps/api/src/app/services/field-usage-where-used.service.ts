import type { ApiConnection } from '@jetstream/salesforce-api';
import { dedupeFieldUsageWhereUsedRows, parseCustomFieldApiNameForTooling, sortFieldUsageWhereUsedRows } from '@jetstream/shared/utils';
import { escapeSoqlStringLiteral } from '../lib/field-usage/soql-escape';
import type { FieldUsageObjectPayload } from './field-usage-query.service';

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

/** Page UI metadata — **On layout** bucket (classic layout, Lightning page, field sets on layouts). */
const WHERE_USED_LAYOUT_TYPES = new Set(['Layout', 'FlexiPage', 'FieldSet']);

export type WhereUsedDependencyRow = {
  type: string;
  name: string;
  kind: 'automation' | 'apex' | 'layout' | 'other';
};

export type WhereUsedMap = Record<string, WhereUsedDependencyRow[]>;

function depKind(componentType: string): WhereUsedDependencyRow['kind'] {
  const t = (componentType || '').trim();
  if (WHERE_USED_AUTOMATION_TYPES.has(t)) {
    return 'automation';
  }
  if (WHERE_USED_APEX_TYPES.has(t)) {
    return 'apex';
  }
  if (WHERE_USED_LAYOUT_TYPES.has(t)) {
    return 'layout';
  }
  return 'other';
}

async function toolingQueryAll(conn: ApiConnection, soql: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  let response = await conn.query.query<Record<string, unknown>>(soql, true);

  while (true) {
    out.push(...response.queryResults.records);
    if (response.queryResults.done) {
      break;
    }
    const nextUrl = response.queryResults.nextRecordsUrl;
    if (!nextUrl) {
      break;
    }
    response = await conn.query.queryMore<Record<string, unknown>>(nextUrl);
  }
  return out;
}

async function getCustomFieldId(conn: ApiConnection, objectName: string, fieldName: string): Promise<string | null> {
  const obj = objectName.trim();
  const toolingNames = parseCustomFieldApiNameForTooling(fieldName);
  if (!obj || !toolingNames) {
    return null;
  }
  const qualifiedObject = escapeSoqlStringLiteral(obj);
  const developer = escapeSoqlStringLiteral(toolingNames.developerName);
  const hasNamespace = toolingNames.namespacePrefix != null && toolingNames.namespacePrefix.length > 0;
  const nsLiteral = hasNamespace ? escapeSoqlStringLiteral(toolingNames.namespacePrefix!) : '';

  /**
   * Tooling matching is picky: `NamespacePrefix = null` often returns no rows (blank vs null in org data).
   * Prefer `EntityDefinition.QualifiedApiName` (same pattern as the sobject-field-list Where Used hook),
   * and only add a NamespacePrefix predicate when the field API name includes a package prefix.
   */
  const attempts: string[] = [];
  if (hasNamespace) {
    attempts.push(
      `SELECT Id FROM CustomField WHERE EntityDefinition.QualifiedApiName = '${qualifiedObject}' AND DeveloperName = '${developer}' AND NamespacePrefix = '${nsLiteral}' LIMIT 1`,
    );
    attempts.push(
      `SELECT Id FROM CustomField WHERE TableEnumOrId = '${qualifiedObject}' AND DeveloperName = '${developer}' AND NamespacePrefix = '${nsLiteral}' LIMIT 1`,
    );
  } else {
    attempts.push(
      `SELECT Id FROM CustomField WHERE EntityDefinition.QualifiedApiName = '${qualifiedObject}' AND DeveloperName = '${developer}' LIMIT 1`,
    );
    attempts.push(`SELECT Id FROM CustomField WHERE TableEnumOrId = '${qualifiedObject}' AND DeveloperName = '${developer}' LIMIT 1`);
  }

  for (const soql of attempts) {
    const rows = await toolingQueryAll(conn, soql);
    const id = rows[0]?.Id;
    if (typeof id === 'string') {
      return id;
    }
  }
  return null;
}

async function getFieldDependencies(conn: ApiConnection, refComponentId: string): Promise<WhereUsedDependencyRow[]> {
  const soql =
    'SELECT MetadataComponentType, MetadataComponentName FROM MetadataComponentDependency ' +
    `WHERE RefMetadataComponentId = '${escapeSoqlStringLiteral(refComponentId)}' AND RefMetadataComponentType = 'CustomField'`;
  const records = await toolingQueryAll(conn, soql);
  const out: WhereUsedDependencyRow[] = [];
  for (const r of records) {
    const t = r.MetadataComponentType != null ? String(r.MetadataComponentType) : '';
    const n = r.MetadataComponentName != null ? String(r.MetadataComponentName) : '';
    if (!t && !n) {
      continue;
    }
    out.push({ type: t, name: n, kind: depKind(t) });
  }
  return sortFieldUsageWhereUsedRows(dedupeFieldUsageWhereUsedRows(out));
}

function collectCustomFieldKeys(objects: Record<string, FieldUsageObjectPayload>): { object: string; field: string }[] {
  const refs: { object: string; field: string }[] = [];
  for (const objName of Object.keys(objects).sort()) {
    const payload = objects[objName];
    if (!payload || payload.error) {
      continue;
    }
    for (const fieldName of Object.keys(payload.fieldUsage)) {
      if (fieldName.endsWith('__c')) {
        refs.push({ object: objName, field: fieldName });
      }
    }
  }
  return refs;
}

/**
 * Tooling MetadataComponentDependency map keyed `ObjectApi.FieldApi` (custom fields only).
 */
export async function computeFieldUsageWhereUsed(
  conn: ApiConnection,
  objects: Record<string, FieldUsageObjectPayload>,
): Promise<WhereUsedMap> {
  const refs = collectCustomFieldKeys(objects);
  const results: WhereUsedMap = {};

  for (const { object: obj, field: fld } of refs) {
    const key = `${obj}.${fld}`;
    const fieldId = await getCustomFieldId(conn, obj, fld);
    if (!fieldId) {
      results[key] = [];
      continue;
    }
    results[key] = await getFieldDependencies(conn, fieldId);
  }

  return results;
}
