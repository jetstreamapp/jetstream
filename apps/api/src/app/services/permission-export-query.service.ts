import type { ApiConnection } from '@jetstream/salesforce-api';
import { queryWithRecordBudget } from '../lib/permission-export/query-with-record-budget';
import {
  chunkIds,
  formatApiNamesForInClause,
  formatIdsForInClause,
  sanitizePermissionExportObjectApiNames,
  uniqueSalesforceIds,
} from '../lib/permission-export/salesforce-soql';
import {
  buildFieldPermissionsByParentSoql,
  buildMutingPermissionSetsByGroupSoql,
  buildObjectPermissionsByParentSoql,
  buildPermissionSetAssignmentsByPermissionSetSoql,
  buildPermissionSetByIdSoql,
  buildPermissionSetGroupByIdSoql,
  buildPermissionSetGroupComponentsByPermissionSetSoql,
  buildTabSettingsByParentSoql,
} from '../lib/permission-export/soql-templates';

const PARENT_ID_CHUNK_SIZE = 200;
const GROUP_ID_CHUNK_SIZE = 200;
/** Keeps `SobjectType IN (...)` clauses within typical SOQL length limits when many objects are selected. */
const OBJECT_SOBJECT_TYPE_IN_CHUNK_SIZE = 80;
/** Hard cap across all exported rows to keep `analysis_job.result` JSON bounded. */
const MAX_EXPORT_RECORDS = 50_000;

export interface PermissionExportQueryPayload {
  truncated: boolean;
  permissionSets: Record<string, unknown>[];
  permissionSetAssignments: Record<string, unknown>[];
  permissionSetGroups: Record<string, unknown>[];
  permissionSetGroupComponents: Record<string, unknown>[];
  mutingPermissionSets: Record<string, unknown>[];
  objectPermissions: Record<string, unknown>[];
  fieldPermissions: Record<string, unknown>[];
  permissionSetTabSettings: Record<string, unknown>[];
  counts: {
    permissionSets: number;
    permissionSetAssignments: number;
    permissionSetGroups: number;
    permissionSetGroupComponents: number;
    mutingPermissionSets: number;
    objectPermissions: number;
    fieldPermissions: number;
    permissionSetTabSettings: number;
  };
}

/**
 * Loads PermissionSet rows plus Object/Field/Tab permission rows for the given PermissionSet Ids
 * (profile permission sets use the same `PermissionSet` parent for child permission objects).
 * When `objectApiNames` is non-empty, ObjectPermissions and FieldPermissions are restricted to those `SobjectType` values.
 */
export async function runPermissionExportSoql(
  conn: ApiConnection,
  profilePermissionSetIds: string[],
  permissionSetIds: string[],
  options?: { objectApiNames?: unknown },
): Promise<PermissionExportQueryPayload> {
  const parentIds = uniqueSalesforceIds([...profilePermissionSetIds, ...permissionSetIds]);
  const objectScope = sanitizePermissionExportObjectApiNames(options?.objectApiNames);
  const objectTypeInFragments: (string | undefined)[] =
    objectScope.length === 0
      ? [undefined]
      : chunkIds(objectScope, OBJECT_SOBJECT_TYPE_IN_CHUNK_SIZE).map((names) => formatApiNamesForInClause(names));

  if (parentIds.length === 0) {
    return {
      truncated: false,
      permissionSets: [],
      permissionSetAssignments: [],
      permissionSetGroups: [],
      permissionSetGroupComponents: [],
      mutingPermissionSets: [],
      objectPermissions: [],
      fieldPermissions: [],
      permissionSetTabSettings: [],
      counts: {
        permissionSets: 0,
        permissionSetAssignments: 0,
        permissionSetGroups: 0,
        permissionSetGroupComponents: 0,
        mutingPermissionSets: 0,
        objectPermissions: 0,
        fieldPermissions: 0,
        permissionSetTabSettings: 0,
      },
    };
  }

  const budget = { remaining: MAX_EXPORT_RECORDS };
  const permissionSets: Record<string, unknown>[] = [];
  const permissionSetAssignments: Record<string, unknown>[] = [];
  const permissionSetGroupComponents: Record<string, unknown>[] = [];
  const permissionSetGroups: Record<string, unknown>[] = [];
  const mutingPermissionSets: Record<string, unknown>[] = [];
  const objectPermissions: Record<string, unknown>[] = [];
  const fieldPermissions: Record<string, unknown>[] = [];
  const permissionSetTabSettings: Record<string, unknown>[] = [];
  let truncated = false;

  const permSetSoql = buildPermissionSetByIdSoql(formatIdsForInClause(parentIds));
  const permSetResult = await queryWithRecordBudget(conn, permSetSoql, budget, permissionSets);
  if (permSetResult.truncated) {
    truncated = true;
  }

  const permissionSetGroupIds = new Set<string>();

  for (const chunk of chunkIds(parentIds, PARENT_ID_CHUNK_SIZE)) {
    if (budget.remaining <= 0) {
      truncated = true;
      break;
    }

    const inClause = formatIdsForInClause(chunk);

    for (const formattedObjectTypes of objectTypeInFragments) {
      const objectSoql = buildObjectPermissionsByParentSoql(inClause, formattedObjectTypes);
      const objectResult = await queryWithRecordBudget(conn, objectSoql, budget, objectPermissions);
      if (objectResult.truncated) {
        truncated = true;
      }
    }

    for (const formattedObjectTypes of objectTypeInFragments) {
      const fieldSoql = buildFieldPermissionsByParentSoql(inClause, formattedObjectTypes);
      const fieldResult = await queryWithRecordBudget(conn, fieldSoql, budget, fieldPermissions);
      if (fieldResult.truncated) {
        truncated = true;
      }
    }

    const tabSoql = buildTabSettingsByParentSoql(inClause);
    const tabResult = await queryWithRecordBudget(conn, tabSoql, budget, permissionSetTabSettings);
    if (tabResult.truncated) {
      truncated = true;
    }

    const assignmentSoql = buildPermissionSetAssignmentsByPermissionSetSoql(inClause);
    const assignmentResult = await queryWithRecordBudget(conn, assignmentSoql, budget, permissionSetAssignments);
    if (assignmentResult.truncated) {
      truncated = true;
    }

    const componentSoql = buildPermissionSetGroupComponentsByPermissionSetSoql(inClause);
    const componentChunk: Record<string, unknown>[] = [];
    const componentResult = await queryWithRecordBudget(conn, componentSoql, budget, componentChunk);
    if (componentResult.truncated) {
      truncated = true;
    }
    for (const row of componentChunk) {
      permissionSetGroupComponents.push(row);
      const groupId = row.PermissionSetGroupId;
      if (typeof groupId === 'string' && groupId.length > 0) {
        permissionSetGroupIds.add(groupId);
      }
    }

    if (budget.remaining <= 0) {
      truncated = true;
      break;
    }
  }

  const sortedGroupIds = uniqueSalesforceIds([...permissionSetGroupIds]);
  for (const groupChunk of chunkIds(sortedGroupIds, GROUP_ID_CHUNK_SIZE)) {
    if (budget.remaining <= 0) {
      truncated = true;
      break;
    }
    const groupInClause = formatIdsForInClause(groupChunk);

    const groupSoql = buildPermissionSetGroupByIdSoql(groupInClause);
    const groupResult = await queryWithRecordBudget(conn, groupSoql, budget, permissionSetGroups);
    if (groupResult.truncated) {
      truncated = true;
    }

    const mutingSoql = buildMutingPermissionSetsByGroupSoql(groupInClause);
    const mutingResult = await queryWithRecordBudget(conn, mutingSoql, budget, mutingPermissionSets);
    if (mutingResult.truncated) {
      truncated = true;
    }
  }

  return {
    truncated,
    permissionSets,
    permissionSetAssignments,
    permissionSetGroups,
    permissionSetGroupComponents,
    mutingPermissionSets,
    objectPermissions,
    fieldPermissions,
    permissionSetTabSettings,
    counts: {
      permissionSets: permissionSets.length,
      permissionSetAssignments: permissionSetAssignments.length,
      permissionSetGroups: permissionSetGroups.length,
      permissionSetGroupComponents: permissionSetGroupComponents.length,
      mutingPermissionSets: mutingPermissionSets.length,
      objectPermissions: objectPermissions.length,
      fieldPermissions: fieldPermissions.length,
      permissionSetTabSettings: permissionSetTabSettings.length,
    },
  };
}
