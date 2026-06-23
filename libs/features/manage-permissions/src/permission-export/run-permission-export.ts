import { queryWithRecordBudget } from '@jetstream/shared/data';
import { sanitizeSobjectApiNames, splitArrayToMaxSize, uniqueSalesforceIds } from '@jetstream/shared/utils';
import type { PermissionExportFullResult, SalesforceOrgUi } from '@jetstream/types';
import { buildIssueCodeSummary, buildPermissionExportFindings } from './build-permission-export-findings';
import {
  buildFieldPermissionsByParentSoql,
  buildMutingPermissionSetsByGroupSoql,
  buildObjectPermissionsByParentSoql,
  buildPermissionSetAssignmentsByPermissionSetSoql,
  buildPermissionSetByIdSoql,
  buildPermissionSetGroupByIdSoql,
  buildPermissionSetGroupComponentsByPermissionSetSoql,
  buildTabSettingsByParentSoql,
} from './soql-templates';

const PARENT_ID_CHUNK_SIZE = 200;
const GROUP_ID_CHUNK_SIZE = 200;
/** Keeps `SobjectType IN (...)` clauses within typical SOQL length limits when many objects are selected. */
const OBJECT_SOBJECT_TYPE_IN_CHUNK_SIZE = 80;

/**
 * Per-category row caps. Each category has its own independent budget so that one heavy category
 * (e.g. FieldPermissions on a large org) cannot silently starve later categories (Tab settings,
 * Assignments, Groups, MutingPermissionSets) of their budget. Caps sum to ~200K worst case but in
 * practice categories like Groups and TabSettings rarely use more than a few thousand rows.
 */
const CATEGORY_BUDGETS = {
  permissionSets: 10_000,
  objectPermissions: 50_000,
  fieldPermissions: 100_000,
  permissionSetTabSettings: 10_000,
  permissionSetAssignments: 100_000,
  permissionSetGroupComponents: 10_000,
  permissionSetGroups: 10_000,
  mutingPermissionSets: 10_000,
} as const;

type ExportCategory = keyof typeof CATEGORY_BUDGETS;

const CATEGORY_LABELS: Record<ExportCategory, string> = {
  permissionSets: 'PermissionSet',
  objectPermissions: 'ObjectPermissions',
  fieldPermissions: 'FieldPermissions',
  permissionSetTabSettings: 'PermissionSetTabSetting',
  permissionSetAssignments: 'PermissionSetAssignment',
  permissionSetGroupComponents: 'PermissionSetGroupComponent',
  permissionSetGroups: 'PermissionSetGroup',
  mutingPermissionSets: 'MutingPermissionSet',
};

export interface RunPermissionExportProgress {
  current: number;
  total: number;
  percent: number;
  label: string;
}

export interface RunPermissionExportOptions {
  /** Optional sobject scope for ObjectPermissions/FieldPermissions */
  objectApiNames?: unknown;
  /** Called periodically with progress info; safe to be a no-op */
  onProgress?: (progress: RunPermissionExportProgress) => void;
  /** Returns true if the caller wants to cancel; checked at chunk boundaries */
  isCanceled?: () => boolean;
}

export interface RunPermissionExportResult {
  truncated: boolean;
  full: PermissionExportFullResult;
}

function emptyResult(requestPayload?: PermissionExportFullResult['requestPayload']): RunPermissionExportResult {
  const counts = {
    permissionSets: 0,
    permissionSetAssignments: 0,
    permissionSetGroups: 0,
    permissionSetGroupComponents: 0,
    mutingPermissionSets: 0,
    objectPermissions: 0,
    fieldPermissions: 0,
    permissionSetTabSettings: 0,
  };
  return {
    truncated: false,
    full: {
      ...(requestPayload ? { requestPayload } : {}),
      phase: 'permission_export_v1',
      summary:
        'Exported 0 permission sets, 0 assignments, 0 permission set groups (0 components, 0 muting permission sets), 0 object permission rows, 0 field permission rows, 0 tab settings (truncated=false). 0 issue(s).',
      truncated: false,
      counts,
      findings: [],
      issueCodeSummary: {},
      permissionSets: [],
      permissionSetAssignments: [],
      permissionSetGroups: [],
      permissionSetGroupComponents: [],
      mutingPermissionSets: [],
      objectPermissions: [],
      fieldPermissions: [],
      permissionSetTabSettings: [],
    },
  };
}

function throwIfCanceled(isCanceled: (() => boolean) | undefined): void {
  if (isCanceled?.()) {
    throw new Error('Job canceled');
  }
}

/**
 * Browser-side implementation of the permission export job. Issues many SOQL queries through
 * `query`/`queryMore` (via `queryWithRecordBudget`), aggregates the rows in memory, and computes
 * the same findings + issue-code summary the server processor used to produce.
 *
 * Mirrors the original server `runPermissionExportSoql` algorithm: PermissionSet first, then per
 * parent-id chunk of 200 we fetch ObjectPermissions/FieldPermissions (optionally re-chunked by
 * sobject type), Tab settings, Assignments, and Group components. Group ids harvested from the
 * components query then drive PermissionSetGroup + MutingPermissionSet queries.
 */
export async function runPermissionExport(
  org: SalesforceOrgUi,
  profilePermissionSetIds: string[],
  permissionSetIds: string[],
  options?: RunPermissionExportOptions,
): Promise<RunPermissionExportResult> {
  const requestPayload: PermissionExportFullResult['requestPayload'] = {
    profileIds: profilePermissionSetIds,
    permissionSetIds: permissionSetIds,
    ...(options?.objectApiNames !== undefined ? { objectApiNames: options.objectApiNames } : {}),
  };

  const parentIds = uniqueSalesforceIds([...profilePermissionSetIds, ...permissionSetIds]);
  const objectScope = sanitizeSobjectApiNames(options?.objectApiNames);
  const objectTypeChunks: (string[] | undefined)[] =
    objectScope.length === 0 ? [undefined] : splitArrayToMaxSize(objectScope, OBJECT_SOBJECT_TYPE_IN_CHUNK_SIZE);

  if (parentIds.length === 0) {
    return emptyResult(requestPayload);
  }

  const parentIdChunks = splitArrayToMaxSize(parentIds, PARENT_ID_CHUNK_SIZE);

  const budgets: Record<ExportCategory, { remaining: number }> = {
    permissionSets: { remaining: CATEGORY_BUDGETS.permissionSets },
    objectPermissions: { remaining: CATEGORY_BUDGETS.objectPermissions },
    fieldPermissions: { remaining: CATEGORY_BUDGETS.fieldPermissions },
    permissionSetTabSettings: { remaining: CATEGORY_BUDGETS.permissionSetTabSettings },
    permissionSetAssignments: { remaining: CATEGORY_BUDGETS.permissionSetAssignments },
    permissionSetGroupComponents: { remaining: CATEGORY_BUDGETS.permissionSetGroupComponents },
    permissionSetGroups: { remaining: CATEGORY_BUDGETS.permissionSetGroups },
    mutingPermissionSets: { remaining: CATEGORY_BUDGETS.mutingPermissionSets },
  };
  const truncatedCategories = new Set<ExportCategory>();

  const permissionSets: Record<string, unknown>[] = [];
  const permissionSetAssignments: Record<string, unknown>[] = [];
  const permissionSetGroupComponents: Record<string, unknown>[] = [];
  const permissionSetGroups: Record<string, unknown>[] = [];
  const mutingPermissionSets: Record<string, unknown>[] = [];
  const objectPermissions: Record<string, unknown>[] = [];
  const fieldPermissions: Record<string, unknown>[] = [];
  const permissionSetTabSettings: Record<string, unknown>[] = [];

  // 1 for the initial PermissionSet query + 5 steps per parent chunk + 2 steps per group chunk (estimated upfront).
  const initialTotal = 1 + parentIdChunks.length * 5;
  let currentStep = 0;
  let totalSteps = initialTotal;

  const emitProgress = (label: string): void => {
    const percent = totalSteps === 0 ? 0 : Math.min(100, Math.round((currentStep / totalSteps) * 100));
    options?.onProgress?.({ current: currentStep, total: totalSteps, percent, label });
  };

  emitProgress(`Loading ${parentIds.length} permission set(s)`);

  throwIfCanceled(options?.isCanceled);
  const permSetResult = await queryWithRecordBudget<Record<string, unknown>>(
    org,
    buildPermissionSetByIdSoql(parentIds),
    false,
    budgets.permissionSets,
    (page) => {
      permissionSets.push(...page);
    },
  );
  if (permSetResult.truncated) {
    truncatedCategories.add('permissionSets');
  }
  currentStep += 1;
  emitProgress(`Loaded ${permissionSets.length} permission set(s)`);

  const permissionSetGroupIds = new Set<string>();

  for (let parentChunkIndex = 0; parentChunkIndex < parentIdChunks.length; parentChunkIndex++) {
    const parentIdChunk = parentIdChunks[parentChunkIndex];
    const parentChunkLabel = parentIdChunks.length > 1 ? ` (batch ${parentChunkIndex + 1} of ${parentIdChunks.length})` : '';
    throwIfCanceled(options?.isCanceled);

    emitProgress(`Querying object permissions${parentChunkLabel}`);
    for (const objectTypeChunk of objectTypeChunks) {
      throwIfCanceled(options?.isCanceled);
      if (budgets.objectPermissions.remaining <= 0) {
        truncatedCategories.add('objectPermissions');
        break;
      }
      const objectResult = await queryWithRecordBudget<Record<string, unknown>>(
        org,
        buildObjectPermissionsByParentSoql(parentIdChunk, objectTypeChunk),
        false,
        budgets.objectPermissions,
        (page) => {
          objectPermissions.push(...page);
        },
      );
      if (objectResult.truncated) {
        truncatedCategories.add('objectPermissions');
      }
    }
    currentStep += 1;

    emitProgress(`Querying field permissions${parentChunkLabel}`);
    for (const objectTypeChunk of objectTypeChunks) {
      throwIfCanceled(options?.isCanceled);
      if (budgets.fieldPermissions.remaining <= 0) {
        truncatedCategories.add('fieldPermissions');
        break;
      }
      const fieldResult = await queryWithRecordBudget<Record<string, unknown>>(
        org,
        buildFieldPermissionsByParentSoql(parentIdChunk, objectTypeChunk),
        false,
        budgets.fieldPermissions,
        (page) => {
          fieldPermissions.push(...page);
        },
      );
      if (fieldResult.truncated) {
        truncatedCategories.add('fieldPermissions');
      }
    }
    currentStep += 1;

    throwIfCanceled(options?.isCanceled);
    emitProgress(`Querying tab visibility settings${parentChunkLabel}`);
    if (budgets.permissionSetTabSettings.remaining > 0) {
      const tabResult = await queryWithRecordBudget<Record<string, unknown>>(
        org,
        buildTabSettingsByParentSoql(parentIdChunk),
        false,
        budgets.permissionSetTabSettings,
        (page) => {
          permissionSetTabSettings.push(...page);
        },
      );
      if (tabResult.truncated) {
        truncatedCategories.add('permissionSetTabSettings');
      }
    } else {
      truncatedCategories.add('permissionSetTabSettings');
    }
    currentStep += 1;

    throwIfCanceled(options?.isCanceled);
    emitProgress(`Querying user/group assignments${parentChunkLabel}`);
    if (budgets.permissionSetAssignments.remaining > 0) {
      const assignmentResult = await queryWithRecordBudget<Record<string, unknown>>(
        org,
        buildPermissionSetAssignmentsByPermissionSetSoql(parentIdChunk),
        false,
        budgets.permissionSetAssignments,
        (page) => {
          permissionSetAssignments.push(...page);
        },
      );
      if (assignmentResult.truncated) {
        truncatedCategories.add('permissionSetAssignments');
      }
    } else {
      truncatedCategories.add('permissionSetAssignments');
    }
    currentStep += 1;

    throwIfCanceled(options?.isCanceled);
    emitProgress(`Querying permission set group memberships${parentChunkLabel}`);
    if (budgets.permissionSetGroupComponents.remaining > 0) {
      const componentResult = await queryWithRecordBudget<Record<string, unknown>>(
        org,
        buildPermissionSetGroupComponentsByPermissionSetSoql(parentIdChunk),
        false,
        budgets.permissionSetGroupComponents,
        (page) => {
          for (const row of page) {
            permissionSetGroupComponents.push(row);
            const groupId = row.PermissionSetGroupId;
            if (typeof groupId === 'string' && groupId.length > 0) {
              permissionSetGroupIds.add(groupId);
            }
          }
        },
      );
      if (componentResult.truncated) {
        truncatedCategories.add('permissionSetGroupComponents');
      }
    } else {
      truncatedCategories.add('permissionSetGroupComponents');
    }
    currentStep += 1;
  }

  const sortedGroupIds = uniqueSalesforceIds([...permissionSetGroupIds]);
  const groupIdChunks = sortedGroupIds.length === 0 ? [] : splitArrayToMaxSize(sortedGroupIds, GROUP_ID_CHUNK_SIZE);
  // Now that we know how many group chunks there are, extend the total so progress reaches 100% accurately.
  totalSteps = initialTotal + groupIdChunks.length * 2;

  for (let groupChunkIndex = 0; groupChunkIndex < groupIdChunks.length; groupChunkIndex++) {
    const groupIdChunk = groupIdChunks[groupChunkIndex];
    const groupChunkLabel = groupIdChunks.length > 1 ? ` (batch ${groupChunkIndex + 1} of ${groupIdChunks.length})` : '';
    throwIfCanceled(options?.isCanceled);

    emitProgress(`Loading permission set group details${groupChunkLabel}`);
    if (budgets.permissionSetGroups.remaining > 0) {
      const groupResult = await queryWithRecordBudget<Record<string, unknown>>(
        org,
        buildPermissionSetGroupByIdSoql(groupIdChunk),
        false,
        budgets.permissionSetGroups,
        (page) => {
          permissionSetGroups.push(...page);
        },
      );
      if (groupResult.truncated) {
        truncatedCategories.add('permissionSetGroups');
      }
    } else {
      truncatedCategories.add('permissionSetGroups');
    }
    currentStep += 1;

    throwIfCanceled(options?.isCanceled);
    emitProgress(`Loading muting permission sets${groupChunkLabel}`);
    if (budgets.mutingPermissionSets.remaining > 0) {
      const mutingResult = await queryWithRecordBudget<Record<string, unknown>>(
        org,
        buildMutingPermissionSetsByGroupSoql(groupIdChunk),
        false,
        budgets.mutingPermissionSets,
        (page) => {
          mutingPermissionSets.push(...page);
        },
      );
      if (mutingResult.truncated) {
        truncatedCategories.add('mutingPermissionSets');
      }
    } else {
      truncatedCategories.add('mutingPermissionSets');
    }
    currentStep += 1;
  }

  const counts = {
    permissionSets: permissionSets.length,
    permissionSetAssignments: permissionSetAssignments.length,
    permissionSetGroups: permissionSetGroups.length,
    permissionSetGroupComponents: permissionSetGroupComponents.length,
    mutingPermissionSets: mutingPermissionSets.length,
    objectPermissions: objectPermissions.length,
    fieldPermissions: fieldPermissions.length,
    permissionSetTabSettings: permissionSetTabSettings.length,
  };

  const findings = buildPermissionExportFindings(objectPermissions, fieldPermissions, {
    permissionSets,
    permissionSetAssignments,
    permissionSetGroupComponents,
    mutingPermissionSets,
    permissionSetTabSettings,
    truncatedCategories,
  });
  const issueCodeSummary = buildIssueCodeSummary(findings);

  const truncated = truncatedCategories.size > 0;
  const truncatedLabel = truncated
    ? `truncated=true (${[...truncatedCategories].map((category) => CATEGORY_LABELS[category]).join(', ')} hit row cap)`
    : 'truncated=false';
  const summary =
    `Exported ${counts.permissionSets} permission sets, ${counts.permissionSetAssignments} assignments, ` +
    `${counts.permissionSetGroups} permission set groups (${counts.permissionSetGroupComponents} components, ` +
    `${counts.mutingPermissionSets} muting permission sets), ${counts.objectPermissions} object permission rows, ` +
    `${counts.fieldPermissions} field permission rows, ${counts.permissionSetTabSettings} tab settings ` +
    `(${truncatedLabel}). ${findings.length} issue(s).`;

  emitProgress('Complete');

  return {
    truncated,
    full: {
      requestPayload,
      phase: 'permission_export_v1',
      summary,
      truncated,
      counts,
      findings,
      issueCodeSummary,
      permissionSets,
      permissionSetAssignments,
      permissionSetGroups,
      permissionSetGroupComponents,
      mutingPermissionSets,
      objectPermissions,
      fieldPermissions,
      permissionSetTabSettings,
    },
  };
}
