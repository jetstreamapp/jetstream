import type { ApiConnection } from '@jetstream/salesforce-api';
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

export type WhereUsedDependencyRow = {
  type: string;
  name: string;
  kind: 'automation' | 'other';
};

export type WhereUsedMap = Record<string, WhereUsedDependencyRow[]>;

function depKind(componentType: string): 'automation' | 'other' {
  const t = (componentType || '').trim();
  return WHERE_USED_AUTOMATION_TYPES.has(t) ? 'automation' : 'other';
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
  const fld = fieldName.trim();
  if (!obj || !fld || !fld.endsWith('__c')) {
    return null;
  }
  const developerName = fld.slice(0, -3);
  const soql = `SELECT Id FROM CustomField WHERE TableEnumOrId = '${escapeSoqlStringLiteral(obj)}' AND DeveloperName = '${escapeSoqlStringLiteral(developerName)}'`;
  const rows = await toolingQueryAll(conn, soql);
  const id = rows[0]?.Id;
  return typeof id === 'string' ? id : null;
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
  out.sort((a, b) => {
    const ka = a.kind === 'automation' ? 0 : 1;
    const kb = b.kind === 'automation' ? 0 : 1;
    if (ka !== kb) {
      return ka - kb;
    }
    return (a.type || '').toLowerCase().localeCompare((b.type || '').toLowerCase()) || (a.name || '').toLowerCase().localeCompare((b.name || '').toLowerCase());
  });
  return out;
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
