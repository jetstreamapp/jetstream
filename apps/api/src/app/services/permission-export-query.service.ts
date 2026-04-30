import type { ApiConnection } from '@jetstream/salesforce-api';
import { queryWithRecordBudget } from '../lib/permission-export/query-with-record-budget';
import { chunkIds, formatIdsForInClause, uniqueSalesforceIds } from '../lib/permission-export/salesforce-soql';
import {
  buildFieldPermissionsByParentSoql,
  buildObjectPermissionsByParentSoql,
  buildPermissionSetByIdSoql,
  buildTabSettingsByParentSoql,
} from '../lib/permission-export/soql-templates';

const PARENT_ID_CHUNK_SIZE = 200;
/** Hard cap across all exported rows to keep `analysis_job.result` JSON bounded. */
const MAX_EXPORT_RECORDS = 50_000;

export interface PermissionExportQueryPayload {
  truncated: boolean;
  permissionSets: Record<string, unknown>[];
  objectPermissions: Record<string, unknown>[];
  fieldPermissions: Record<string, unknown>[];
  permissionSetTabSettings: Record<string, unknown>[];
  counts: {
    permissionSets: number;
    objectPermissions: number;
    fieldPermissions: number;
    permissionSetTabSettings: number;
  };
}

/**
 * Loads PermissionSet rows plus Object/Field/Tab permission rows for the given PermissionSet Ids
 * (profile permission sets use the same `PermissionSet` parent for child permission objects).
 */
export async function runPermissionExportSoql(
  conn: ApiConnection,
  profilePermissionSetIds: string[],
  permissionSetIds: string[],
): Promise<PermissionExportQueryPayload> {
  const parentIds = uniqueSalesforceIds([...profilePermissionSetIds, ...permissionSetIds]);

  if (parentIds.length === 0) {
    return {
      truncated: false,
      permissionSets: [],
      objectPermissions: [],
      fieldPermissions: [],
      permissionSetTabSettings: [],
      counts: {
        permissionSets: 0,
        objectPermissions: 0,
        fieldPermissions: 0,
        permissionSetTabSettings: 0,
      },
    };
  }

  const budget = { remaining: MAX_EXPORT_RECORDS };
  const permissionSets: Record<string, unknown>[] = [];
  const objectPermissions: Record<string, unknown>[] = [];
  const fieldPermissions: Record<string, unknown>[] = [];
  const permissionSetTabSettings: Record<string, unknown>[] = [];
  let truncated = false;

  const permSetSoql = buildPermissionSetByIdSoql(formatIdsForInClause(parentIds));
  const permSetResult = await queryWithRecordBudget(conn, permSetSoql, budget, permissionSets);
  if (permSetResult.truncated) {
    truncated = true;
  }

  for (const chunk of chunkIds(parentIds, PARENT_ID_CHUNK_SIZE)) {
    if (budget.remaining <= 0) {
      truncated = true;
      break;
    }

    const inClause = formatIdsForInClause(chunk);

    const objectSoql = buildObjectPermissionsByParentSoql(inClause);
    const objectResult = await queryWithRecordBudget(conn, objectSoql, budget, objectPermissions);
    if (objectResult.truncated) {
      truncated = true;
    }

    const fieldSoql = buildFieldPermissionsByParentSoql(inClause);
    const fieldResult = await queryWithRecordBudget(conn, fieldSoql, budget, fieldPermissions);
    if (fieldResult.truncated) {
      truncated = true;
    }

    const tabSoql = buildTabSettingsByParentSoql(inClause);
    const tabResult = await queryWithRecordBudget(conn, tabSoql, budget, permissionSetTabSettings);
    if (tabResult.truncated) {
      truncated = true;
    }

    if (budget.remaining <= 0) {
      truncated = true;
      break;
    }
  }

  return {
    truncated,
    permissionSets,
    objectPermissions,
    fieldPermissions,
    permissionSetTabSettings,
    counts: {
      permissionSets: permissionSets.length,
      objectPermissions: objectPermissions.length,
      fieldPermissions: fieldPermissions.length,
      permissionSetTabSettings: permissionSetTabSettings.length,
    },
  };
}
