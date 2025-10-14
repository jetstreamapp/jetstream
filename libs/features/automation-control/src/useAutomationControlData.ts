import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { useRollbar } from '@jetstream/shared/ui-utils';
import { getErrorMessage, getErrorMessageAndStackObj } from '@jetstream/shared/utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { useAmplitude } from '@jetstream/ui-core';
import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  fetchAutomationData,
  getAdditionalItemsWorkflowRuleText,
  getAutomationTypeLabel,
  getProcessBuildersMetadata,
  isFetchSuccess,
  isTableRow,
  isTableRowChild,
  isTableRowItem,
} from './automation-control-data-utils';
import {
  AutomationMetadataType,
  DuplicateRuleRecord,
  FetchErrorPayload,
  FetchSuccessPayload,
  FlowViewRecord,
  StateData,
  TableRow,
  TableRowItem,
  TableRowItemChild,
  TableRowItemSnapshot,
  TableRowOrItemOrChild,
  ToolingApexTriggerRecord,
  ToolingValidationRuleRecord,
  ToolingWorkflowRuleRecord,
} from './automation-control-types';

type Action =
  | { type: 'FETCH_START'; payload: { selectedTypes: Set<string> } }
  | { type: 'FETCH_REFRESH'; payload: { selectedTypes: (keyof StateData)[] } }
  | { type: 'FETCH_SUCCESS'; payload: FetchSuccessPayload }
  | { type: 'FETCH_ERROR'; payload: FetchErrorPayload }
  | { type: 'FETCH_FINISH' }
  | { type: 'UPDATE_IS_ACTIVE_FLAG'; payload: { row: TableRowOrItemOrChild; value: boolean } }
  | { type: 'TOGGLE_ROW_EXPAND'; payload: { row: TableRowOrItemOrChild; value: boolean } }
  | { type: 'TOGGLE_ALL'; payload: { value: boolean } }
  | { type: 'RESTORE_SNAPSHOT'; payload: { snapshot: TableRowItemSnapshot[] } }
  | { type: 'TABLE_ROWS_CHANGED'; payload: { rows: readonly TableRowOrItemOrChild[] } }
  | { type: 'RESET' }
  | { type: 'ERROR'; payload?: { errorMessage: string } };

interface State {
  loading: boolean;
  hasError: boolean;
  errorMessage?: string | null;
  data: StateData;
  /** These are the only data points that are updated over time */
  rows: (TableRow | TableRowItem | TableRowItemChild)[];
  /** All rows fetched from the backend, regardless of filtering or UI state */
  visibleRows: (TableRow | TableRowItem | TableRowItemChild)[];
  /** Rows currently displayed in the UI table (filtered subset of visibleRows) */
  tableRows: readonly TableRowOrItemOrChild[];
  /** allows accessing and changing data without iteration */
  rowsByKey: Record<string, TableRow | TableRowItem | TableRowItemChild>;
  /** Used to know order to rebuild rows from rowsByKey */
  keys: string[];
  dirtyCount: number;
}

function isDirty(row: TableRow | TableRowItem | TableRowItemChild) {
  if (isTableRowItem(row) && (!row.children || !row.children.length)) {
    return row.isActive !== row.isActiveInitialState;
  } else if (isTableRowChild(row)) {
    return row.isActive !== row.isActiveInitialState;
  }
  return false;
}

/**
 * Toggles a parent row (TableRowItem) and its children to the specified value.
 * For flows/process builders with versions (children), handles enabling the max visible version.
 */
function toggleParentRow(
  row: TableRowItem,
  value: boolean,
  rowsByKey: Record<string, TableRow | TableRowItem | TableRowItemChild>,
  tableRows: readonly TableRowOrItemOrChild[],
) {
  const key = row.key;
  const fullParentRow = rowsByKey[key] as TableRowItem;
  rowsByKey[key] = { ...fullParentRow, isActive: value };

  // Handle flows or process builders (only ones with children/versions)
  if (Array.isArray(fullParentRow.children) && fullParentRow.children.length > 0) {
    if (value) {
      // ENABLE: Find the max version among VISIBLE children in the table
      const visibleChildrenKeys = new Set(
        tableRows.filter((r) => isTableRowChild(r) && r.parentKey === key).map((r) => r.key),
      );

      // Get all visible children from the full children list
      const visibleChildren = fullParentRow.children.filter((child) => visibleChildrenKeys.has(child.key));

      // Set all children to false initially
      fullParentRow.children.forEach((child) => {
        rowsByKey[child.key] = { ...rowsByKey[child.key], isActive: false };
      });

      // If there are visible children, find and enable the max version among them
      if (visibleChildren.length > 0) {
        const maxVisibleVersion = visibleChildren.reduce((maxRow: TableRowItemChild, child) => {
          if (!maxRow) {
            return child;
          }
          return maxRow.record.VersionNumber > child.record.VersionNumber ? maxRow : child;
        }, visibleChildren[0]);

        // Enable the max visible version
        rowsByKey[maxVisibleVersion.key] = { ...rowsByKey[maxVisibleVersion.key], isActive: true };
        (rowsByKey[key] as TableRowItem).activeVersionNumber = maxVisibleVersion.record.VersionNumber;
      } else {
        // No visible children, so no active version
        (rowsByKey[key] as TableRowItem).activeVersionNumber = null;
      }
    } else {
      // DISABLE: Set all children to disabled (even non-visible ones)
      fullParentRow.children.forEach((child) => {
        rowsByKey[child.key] = { ...rowsByKey[child.key], isActive: false };
      });
      (rowsByKey[key] as TableRowItem).activeVersionNumber = null;
    }
  }
}

/**
 * Toggles a child row (TableRowItemChild) to the specified value.
 * When enabling, disables all siblings and enables the parent.
 * When disabling, checks if parent should also be disabled.
 */
function toggleChildRow(
  row: TableRowItemChild,
  value: boolean,
  rowsByKey: Record<string, TableRow | TableRowItem | TableRowItemChild>,
  allRows: (TableRow | TableRowItem | TableRowItemChild)[],
) {
  rowsByKey[row.key] = { ...rowsByKey[row.key], isActive: value };

  const parentRow = rowsByKey[row.parentKey] as TableRowItem;
  if (!parentRow) {
    return;
  }

  // Get all children for this parent
  const allChildren = allRows.filter((r) => isTableRowChild(r) && r.parentKey === row.parentKey) as TableRowItemChild[];

  if (value) {
    // ENABLE: Disable all siblings, then enable only this one
    allChildren.forEach((child) => {
      if (child.key !== row.key) {
        rowsByKey[child.key] = { ...rowsByKey[child.key], isActive: false };
      }
    });
    // Update parent to reflect the active child
    rowsByKey[row.parentKey] = { ...parentRow, isActive: true };
    (rowsByKey[row.parentKey] as TableRowItem).activeVersionNumber = row.record.VersionNumber;
  } else {
    // DISABLE: Check if any siblings are still active after disabling this one
    const updatedChildren = allChildren.map((child) =>
      child.key === row.key ? { ...child, isActive: false } : rowsByKey[child.key],
    ) as TableRowItemChild[];
    const anyActiveChild = updatedChildren.some((child) => child.isActive);

    if (!anyActiveChild) {
      // No active children, disable parent
      rowsByKey[row.parentKey] = { ...parentRow, isActive: false };
      (rowsByKey[row.parentKey] as TableRowItem).activeVersionNumber = null;
    } else {
      // Some child is still active, update active version number
      const activeChild = updatedChildren.find((child) => child.isActive);
      if (activeChild) {
        (rowsByKey[row.parentKey] as TableRowItem).activeVersionNumber = activeChild.record.VersionNumber;
      }
    }
  }
}

type MetadataRecordType =
  | { type: 'ApexTrigger'; records: ToolingApexTriggerRecord[] }
  | { type: 'DuplicateRule'; records: DuplicateRuleRecord[] }
  | { type: 'ValidationRule'; records: ToolingValidationRuleRecord[] }
  | { type: 'WorkflowRule'; records: ToolingWorkflowRuleRecord[] }
  | { type: 'FlowRecordTriggered'; records: FlowViewRecord[] }
  | { type: 'FlowProcessBuilder'; records: FlowViewRecord[] };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'FETCH_START': {
      const { selectedTypes } = action.payload;
      const output: State = {
        ...state,
        hasError: false,
        errorMessage: null,
        loading: true,
        data: { ...state.data },
      };
      (
        [
          'ApexTrigger',
          'DuplicateRule',
          'ValidationRule',
          'WorkflowRule',
          'FlowRecordTriggered',
          'FlowProcessBuilder',
        ] as AutomationMetadataType[]
      ).forEach((type) => {
        output.data[type] = {
          loading: selectedTypes.has(type),
          skip: !selectedTypes.has(type),
          records: [],
          tableRow: getRowsForItems({ type, records: [] }, true),
        };
      });

      const { keys, rows, rowsByKey } = flattenTableRows(output.data, {});
      output.keys = keys;
      output.rows = rows;
      output.rowsByKey = rowsByKey;
      output.visibleRows = getVisibleRows(output.rows, rowsByKey);
      output.dirtyCount = rows.reduce((output, row) => output + (isDirty(row) ? 1 : 0), 0);
      return output;
    }
    case 'FETCH_REFRESH': {
      const { selectedTypes } = action.payload;
      const output: State = {
        ...state,
        hasError: false,
        errorMessage: null,
        loading: true,
        data: { ...state.data },
      };
      selectedTypes.forEach((type) => {
        output.data[type] = {
          ...output.data[type],
          loading: true,
          records: [],
          tableRow: getRowsForItems({ type, records: [] }, true),
        };
      });

      const { keys, rows, rowsByKey } = flattenTableRows(output.data, {});
      output.keys = keys;
      output.rows = rows;
      output.rowsByKey = rowsByKey;
      output.visibleRows = getVisibleRows(output.rows, rowsByKey);
      output.dirtyCount = rows.reduce((output, row) => output + (isDirty(row) ? 1 : 0), 0);
      return output;
    }
    case 'FETCH_SUCCESS': {
      const output: State = {
        ...state,
        data: {
          ...state.data,
          [action.payload.type]: {
            loading: false,
            records: action.payload.records,
            tableRow: getRowsForItems({ type: action.payload.type, records: action.payload.records as any }, false),
          },
        },
      };
      const { keys, rows, rowsByKey } = flattenTableRows(output.data, state.rowsByKey);
      output.keys = keys;
      output.rows = rows;
      output.rowsByKey = rowsByKey;
      output.visibleRows = getVisibleRows(output.rows, rowsByKey);
      output.dirtyCount = rows.reduce((output, row) => output + (isDirty(row) ? 1 : 0), 0);
      return output;
    }
    case 'FETCH_ERROR': {
      const output: State = {
        ...state,
        data: {
          ...state.data,
          [action.payload.type]: {
            ...state.data[action.payload.type],
            loading: false,
            error: action.payload.error,
            tableRow: {
              ...state.data[action.payload.type].tableRow,
              loading: false,
              hasError: true,
              errorMessage: action.payload.error,
            },
          },
        },
      };
      const { keys, rows, rowsByKey } = flattenTableRows(output.data, state.rowsByKey);
      output.keys = keys;
      output.rows = rows;
      output.visibleRows = getVisibleRows(rows, rowsByKey);
      output.rowsByKey = rowsByKey;
      output.dirtyCount = rows.reduce((output, row) => output + (isDirty(row) ? 1 : 0), 0);
      return output;
    }
    case 'FETCH_FINISH':
      logger.log('FETCH_FINISH', { state });
      return { ...state, loading: false };
    case 'UPDATE_IS_ACTIVE_FLAG': {
      const key = action.payload.row.key;
      const rowsByKey = { ...state.rowsByKey };

      if (isTableRowItem(action.payload.row)) {
        rowsByKey[key] = { ...rowsByKey[key], isActive: action.payload.value };
      } else if (isTableRowChild(action.payload.row)) {
        const row = { ...rowsByKey[key], isActive: action.payload.value } as TableRowItemChild;
        const parentRow = { ...rowsByKey[row.parentKey], isActive: action.payload.value } as TableRowItem;
        // no matter what all sibling rows should be false
        const siblingRows = state.rows
          .filter((row) => isTableRowChild(row) && row.parentKey === parentRow.key && row.key !== key)
          .map((row) => ({ ...row, isActive: false }));

        [row, parentRow, ...siblingRows].forEach((row) => (rowsByKey[row.key] = row));
        // identify active version as it is used for deployment
        if (parentRow.isActive) {
          const activeVersion = [row, ...siblingRows].find((row) => row.isActive) as TableRowItemChild | undefined;
          if (activeVersion) {
            parentRow.activeVersionNumber = activeVersion.record.VersionNumber;
          } else {
            parentRow.activeVersionNumber = null;
          }
        } else {
          parentRow.activeVersionNumber = null;
        }
      }
      const output: State = {
        ...state,
        rows: state.keys.map((rowKey) => rowsByKey[rowKey]),
        rowsByKey,
      };
      output.visibleRows = getVisibleRows(output.rows, rowsByKey);
      output.dirtyCount = output.rows.reduce((output, row) => output + (isDirty(row) ? 1 : 0), 0);
      return output;
    }
    case 'TOGGLE_ROW_EXPAND': {
      // toggleRowExpand
      logger.log('TOGGLE_ROW_EXPAND', { state });
      const key = action.payload.row.key;
      const rowsByKey = { ...state.rowsByKey };
      rowsByKey[key] = { ...rowsByKey[action.payload.row.key], isExpanded: action.payload.value };

      const output: State = {
        ...state,
        rows: state.keys.map((rowKey) => rowsByKey[rowKey]),
        rowsByKey,
      };
      output.visibleRows = getVisibleRows(output.rows, rowsByKey);
      return output;
    }
    case 'TOGGLE_ALL': {
      const rowsByKey = { ...state.rowsByKey };
      const processedParents = new Set<string>();

      state.tableRows.forEach((row) => {
        if (isTableRowItem(row)) {
          // Check if this parent has any visible children in tableRows
          const hasVisibleChildren = state.tableRows.some(
            (r) => isTableRowChild(r) && r.parentKey === row.key
          );

          // Only process parent if it has no children OR has visible children in tableRows
          if (!row.children || row.children.length === 0 || hasVisibleChildren) {
            toggleParentRow(row, action.payload.value, rowsByKey, state.tableRows);
            processedParents.add(row.key);
          }
        } else if (isTableRowChild(row)) {
          // Only process child rows if their parent wasn't already processed
          if (!processedParents.has(row.parentKey)) {
            // Mark parent as processed to avoid processing siblings multiple times
            processedParents.add(row.parentKey);

            // Get all visible child rows for this parent from the table
            const visibleSiblings = state.tableRows.filter(
              (r) => isTableRowChild(r) && r.parentKey === row.parentKey
            ) as TableRowItemChild[];

            if (action.payload.value) {
              // ENABLE: Find the max version among visible siblings
              const maxVersionChild = visibleSiblings.reduce((maxRow: TableRowItemChild, child) => {
                return maxRow.record.VersionNumber > child.record.VersionNumber ? maxRow : child;
              }, visibleSiblings[0]);

              // Toggle the max version child
              toggleChildRow(maxVersionChild, true, rowsByKey, state.rows);
            } else {
              // DISABLE: Toggle the first child (which will disable all)
              toggleChildRow(row, false, rowsByKey, state.rows);
            }
          }
        }
      });

      const output: State = {
        ...state,
        rows: state.keys.map((rowKey) => rowsByKey[rowKey]),
        rowsByKey,
      };
      output.visibleRows = getVisibleRows(output.rows, rowsByKey);
      output.dirtyCount = output.rows.reduce((output, row) => output + (isDirty(row) ? 1 : 0), 0);
      return output;
    }
    case 'RESTORE_SNAPSHOT': {
      const { snapshot } = action.payload;
      const rowsByKey = { ...state.rowsByKey };

      snapshot.forEach(({ key, isActive, activeVersionNumber }) => {
        if (rowsByKey[key]) {
          (rowsByKey[key] as TableRowItem).isActive = isActive;
          (rowsByKey[key] as TableRowItem).activeVersionNumber = activeVersionNumber;
        }
      });

      const output: State = {
        ...state,
        rows: state.keys.map((rowKey) => rowsByKey[rowKey]),
        rowsByKey,
      };
      output.visibleRows = getVisibleRows(output.rows, rowsByKey);
      output.dirtyCount = output.rows.reduce((output, row) => output + (isDirty(row) ? 1 : 0), 0);
      return output;
    }
    case 'TABLE_ROWS_CHANGED': {
      const { rows } = action.payload;
      return {
        ...state,
        tableRows: rows,
      };
    }
    case 'RESET': {
      const rowsByKey = { ...state.rowsByKey };
      Object.keys(rowsByKey)
        .filter((key) => !isTableRow(rowsByKey[key]))
        .forEach((key) => {
          rowsByKey[key] = { ...rowsByKey[key], isActive: (rowsByKey[key] as TableRowItem | TableRowItemChild).isActiveInitialState };
        });
      const output: State = {
        ...state,
        rows: state.keys.map((rowKey) => rowsByKey[rowKey]),
        rowsByKey,
        dirtyCount: 0,
      };
      output.visibleRows = getVisibleRows(output.rows, rowsByKey);
      output.dirtyCount = output.rows.reduce((output, row) => output + (isDirty(row) ? 1 : 0), 0);
      return output;
    }
    case 'ERROR':
      logger.log('ERROR', action.payload?.errorMessage, { state });
      return { ...state, loading: false, hasError: true, errorMessage: action.payload?.errorMessage };
    default:
      throw new Error('Invalid action');
  }
}

function getRowsForItems({ type, records }: MetadataRecordType, loading: boolean, errorMessage?: string): TableRow {
  const typeLabel = getAutomationTypeLabel(type);
  const output: TableRow = {
    path: [typeLabel],
    key: type,
    label: getAutomationTypeLabel(type),
    type,
    loading: false,
    hasError: false,
    isExpanded: true,
    items: [],
  };

  if (errorMessage) {
    output.hasError = true;
    output.errorMessage = errorMessage;
    return output;
  } else if (loading) {
    output.loading = true;
    return output;
  } else if (!records || records.length === 0) {
    return output;
  }

  switch (type) {
    case 'ApexTrigger': {
      output.items = (records as ToolingApexTriggerRecord[]).map(
        (record): TableRowItem => ({
          path: [typeLabel, record.Name],
          key: `${type}_${record.Id}`,
          parentKey: type,
          type,
          record,
          link: `/lightning/setup/ObjectManager/${record.EntityDefinitionId}/ApexTriggers/${record.Id}/view`,
          sobject: record.EntityDefinition.QualifiedApiName,
          readOnly: false,
          isExpanded: true,
          isActive: record.Status === 'Active',
          isActiveInitialState: record.Status === 'Active',
          label: record.Name,
          lastModifiedBy: `${record.LastModifiedBy.Name} ${record.LastModifiedDate}`,
          description: '',
          additionalData: [],
        }),
      );
      break;
    }
    case 'DuplicateRule': {
      output.items = (records as DuplicateRuleRecord[]).map(
        (record): TableRowItem => ({
          path: [typeLabel, record.DeveloperName],
          key: `${type}_${record.Id}`,
          parentKey: type,
          type,
          record,
          link: `/lightning/setup/DuplicateRules/page?address=${encodeURIComponent(`/${record.Id}?setupid=DuplicateRules`)}`,
          sobject: record.SobjectType,
          readOnly: false,
          isExpanded: true,
          isActive: record.IsActive,
          isActiveInitialState: record.IsActive,
          label: record.MasterLabel,
          lastModifiedBy: `${record.LastModifiedBy.Name} ${record.LastModifiedDate}`,
          description: '',
          additionalData: [],
        }),
      );
      break;
    }
    case 'ValidationRule': {
      output.items = (records as ToolingValidationRuleRecord[]).map(
        (record): TableRowItem => ({
          path: [typeLabel, record.ValidationName],
          key: `${type}_${record.Id}`,
          parentKey: type,
          type,
          record,
          link: `/lightning/setup/ObjectManager/${record.EntityDefinitionId}/ValidationRules/${record.Id}/view`,
          sobject: record.EntityDefinition.QualifiedApiName,
          readOnly: false,
          isExpanded: true,
          isActive: record.Active,
          isActiveInitialState: record.Metadata.active,
          label: record.ValidationName,
          lastModifiedBy: `${record.LastModifiedBy.Name} ${record.LastModifiedDate}`,
          description: record.Description,
          additionalData: [
            { label: 'Condition', value: record.Metadata.errorConditionFormula },
            { label: 'Message', value: record.ErrorMessage },
          ],
        }),
      );
      break;
    }
    case 'WorkflowRule': {
      output.items = (records as ToolingWorkflowRuleRecord[]).map(
        (record): TableRowItem => ({
          path: [typeLabel, record.Name],
          key: `${type}_${record.Id}`,
          parentKey: type,
          type,
          record,
          link: `/lightning/setup/WorkflowRules/page?address=${encodeURIComponent(`/${record.Id}?nodeId=DuplicateRules`)}`,
          sobject: record.TableEnumOrId,
          readOnly: false,
          isExpanded: true,
          isActive: record.Metadata.active,
          isActiveInitialState: record.Metadata.active,
          label: record.Name,
          lastModifiedBy: `${record.LastModifiedBy.Name} ${record.LastModifiedDate}`,
          description: record.Metadata.description,
          additionalData: getAdditionalItemsWorkflowRuleText(record.Metadata),
        }),
      );
      break;
    }
    case 'FlowRecordTriggered':
    case 'FlowProcessBuilder': {
      output.items = (records as FlowViewRecord[]).map((record): TableRowItem => {
        const activeVersionNumber =
          record.Versions.records.find(({ DurableId }) => record.ActiveVersionId === DurableId)?.VersionNumber || null;
        return {
          path: [typeLabel, record.ApiName],
          key: `${type}_${record.DurableId}`,
          parentKey: type,
          type,
          record,
          link:
            type === 'FlowProcessBuilder'
              ? `/lightning/setup/ProcessAutomation/home`
              : // For some reason this only works if it is double encoded, as SFDC seems like they do an extra decode during front-door process
                `/lightning/setup/Flows/page?address=${encodeURIComponent(
                  encodeURIComponent(`/${record.DurableId}?retUrl=/lightning/setup/Flows/home`),
                )}`,
          sobject: record.TriggerObjectOrEvent?.QualifiedApiName || '',
          readOnly: true,
          isExpanded: true,
          isActive: record.ActiveVersionId != null,
          isActiveInitialState: record.ActiveVersionId != null,
          activeVersionNumber,
          activeVersionNumberInitialState: activeVersionNumber,
          label: record.Label,
          lastModifiedBy: `${record.LastModifiedBy} ${record.LastModifiedDate}`,
          description: record.Description,
          additionalData: [
            {
              label: 'Active Version',
              value: record.ActiveVersionId ? `${activeVersionNumber || ''}` : null,
            },
            {
              label: 'Latest Version',
              value: record.LatestVersionId
                ? `${record.Versions.records.find(({ DurableId }) => record.LatestVersionId === DurableId)?.VersionNumber || ''}`
                : null,
            },
          ].filter(({ value }) => !!value),
          children: record.Versions.records.map(
            (version): TableRowItemChild => ({
              path: [typeLabel, record.ApiName, `Version ${version.VersionNumber}: ${version.Label}`],
              key: `${type}_${record.DurableId}_${version.DurableId}`,
              parentKey: `${type}_${record.DurableId}`,
              type,
              isExpanded: false,
              record: version,
              link: type === 'FlowProcessBuilder' ? null : `/builder_platform_interaction/flowBuilder.app?flowId=${version.DurableId}`,
              sobject: record.TriggerObjectOrEvent?.QualifiedApiName || '',
              isActive: version.DurableId === record.ActiveVersionId,
              isActiveInitialState: version.DurableId === record.ActiveVersionId,
              label: `${record.Label} (V${version.VersionNumber})`,
              lastModifiedBy: `${version.LastModifiedDate}`,
              description: version.Description,
              additionalData: [
                { label: 'Version', value: `${version.VersionNumber}` },
                { label: 'API Version', value: version.ApiVersionRuntime },
              ],
            }),
          ),
        };
      });
      break;
    }
    default:
      break;
  }
  return output;
}

function flattenTableRows(
  stateData: StateData,
  rowsByKeyInit: Record<string, TableRow | TableRowItem | TableRowItemChild>,
): {
  rows: (TableRow | TableRowItem | TableRowItemChild)[];
  rowsByKey: Record<string, TableRow | TableRowItem | TableRowItemChild>;
  keys: string[];
} {
  const rows: (TableRow | TableRowItem | TableRowItemChild)[] = [];
  const rowsByKey: Record<string, TableRow | TableRowItem | TableRowItemChild> = {};
  const keys: string[] = [];
  Object.keys(stateData)
    .filter((type) => {
      const tableRow = stateData[type as keyof StateData].tableRow as TableRow;
      // if not selected, or loading is done and there are no items, skip
      return !stateData[type as keyof StateData].skip && (tableRow.loading || tableRow.hasError || tableRow.items.length);
    })
    .forEach((type) => {
      const row = stateData[type as keyof StateData].tableRow as TableRow;
      rows.push(row);
      rowsByKey[row.key] = row;
      keys.push(row.key);
      if (row.items && row.items.length > 0) {
        row.items.forEach((item) => {
          // keep existing item if it already exists
          item = (rowsByKeyInit[item.key] as TableRowItem) || item;
          rows.push(item);
          rowsByKey[item.key] = item;
          keys.push(item.key);
          if (item.children) {
            item.children.forEach((child) => {
              // keep existing child if it exists
              child = (rowsByKeyInit[child.key] as TableRowItemChild) || child;
              rows.push(child);
              rowsByKey[child.key] = child;
              keys.push(child.key);
            });
          }
        });
      }
    });
  return { rows, rowsByKey, keys };
}

function getVisibleRows(
  rows: (TableRow | TableRowItem | TableRowItemChild)[],
  rowsByKey: Record<string, TableRow | TableRowItem | TableRowItemChild>,
) {
  return rows.filter((row) => {
    if (isTableRow(row)) {
      return true;
    } else if (isTableRowItem(row) && rowsByKey[row.parentKey]?.isExpanded) {
      return true;
    } else if (
      isTableRowChild(row) &&
      rowsByKey[row.parentKey]?.isExpanded &&
      rowsByKey[(rowsByKey[row.parentKey] as TableRowItem)?.parentKey]?.isExpanded
    ) {
      return true;
    }
    return false;
  });
}

export function useAutomationControlData({
  selectedOrg,
  defaultApiVersion,
  selectedSObjects,
  selectedAutomationTypes,
}: {
  selectedOrg: SalesforceOrgUi;
  defaultApiVersion: string;
  selectedSObjects: string[];
  selectedAutomationTypes: AutomationMetadataType[];
}) {
  const isMounted = useRef(true);
  const { trackEvent } = useAmplitude();
  const rollbar = useRollbar();

  const [{ loading, hasError, errorMessage, data, rows, visibleRows, dirtyCount }, dispatch] = useReducer(reducer, {
    loading: false,
    hasError: false,
    data: {
      ApexTrigger: { loading: true, skip: false, records: [], tableRow: getRowsForItems({ type: 'ApexTrigger', records: [] }, false) },
      DuplicateRule: {
        loading: true,
        skip: false,
        records: [],
        tableRow: getRowsForItems({ type: 'DuplicateRule', records: [] }, false),
      },
      ValidationRule: {
        loading: true,
        skip: false,
        records: [],
        tableRow: getRowsForItems({ type: 'ValidationRule', records: [] }, false),
      },
      WorkflowRule: { loading: true, skip: false, records: [], tableRow: getRowsForItems({ type: 'WorkflowRule', records: [] }, false) },
      FlowRecordTriggered: {
        loading: true,
        skip: false,
        records: [],
        tableRow: getRowsForItems({ type: 'FlowRecordTriggered', records: [] }, false),
      },
      FlowProcessBuilder: {
        loading: true,
        skip: false,
        records: [],
        tableRow: getRowsForItems({ type: 'FlowProcessBuilder', records: [] }, false),
      },
    },
    rows: [],
    visibleRows: [],
    tableRows: [],
    rowsByKey: {},
    keys: [],
    dirtyCount: 0,
  });

  useEffect(() => {
    isMounted.current = true;
    trackEvent(ANALYTICS_KEYS.automation_selection, { selectedSObjects: selectedSObjects.length, types: selectedAutomationTypes });
    return () => {
      isMounted.current = false;
    };
  }, [selectedAutomationTypes, selectedSObjects.length, trackEvent]);

  const updateIsActiveFlag = useCallback((row: TableRowOrItemOrChild, value: boolean) => {
    dispatch({ type: 'UPDATE_IS_ACTIVE_FLAG', payload: { row, value } });
  }, []);

  const toggleRowExpand = useCallback((row: TableRowOrItemOrChild, value: boolean) => {
    dispatch({ type: 'TOGGLE_ROW_EXPAND', payload: { row, value } });
  }, []);

  const resetChanges = useCallback(() => {
    dispatch({ type: 'RESET' });
    trackEvent(ANALYTICS_KEYS.automation_toggle_all, { type: 'reset' });
  }, [trackEvent]);

  const toggleAll = useCallback(
    (value: boolean) => {
      dispatch({ type: 'TOGGLE_ALL', payload: { value } });
      trackEvent(ANALYTICS_KEYS.automation_toggle_all, { type: value ? 'all' : 'none' });
    },
    [trackEvent],
  );

  const tableRowsChange = useCallback((rows: readonly TableRowOrItemOrChild[]) => {
    dispatch({ type: 'TABLE_ROWS_CHANGED', payload: { rows } });
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const selectedTypes = new Set(selectedAutomationTypes);
      dispatch({ type: 'FETCH_START', payload: { selectedTypes } });

      const obs = fetchAutomationData(selectedOrg, defaultApiVersion, selectedAutomationTypes, selectedSObjects).subscribe({
        next: (item) => {
          if (isFetchSuccess(item)) {
            dispatch({ type: 'FETCH_SUCCESS', payload: item });
          } else {
            dispatch({ type: 'FETCH_ERROR', payload: item });
            rollbar.error('Automation Control Fetch Error', { item });
          }
        },
        error: (err) => {
          dispatch({ type: 'ERROR', payload: { errorMessage: err.message } });
          logger.error('[AUTOMATION][FETCH][ERROR]', err);
          rollbar.error('Automation Control Fatal Error', getErrorMessageAndStackObj(err));
        },
        complete: () => {
          dispatch({ type: 'FETCH_FINISH' });
          logger.info('[AUTOMATION][FETCH][FINISH]');
        },
      });
      return () => {
        obs.unsubscribe();
      };
    } catch (ex) {
      dispatch({ type: 'ERROR', payload: { errorMessage: getErrorMessage(ex) } });
    }
  }, [selectedAutomationTypes, selectedOrg, defaultApiVersion, selectedSObjects, rollbar]);

  const refreshProcessBuilders = useCallback(async () => {
    dispatch({ type: 'FETCH_REFRESH', payload: { selectedTypes: ['FlowProcessBuilder'] } });
    trackEvent(ANALYTICS_KEYS.automation_process_builder_refresh);
    try {
      const records = await getProcessBuildersMetadata(selectedOrg, defaultApiVersion, selectedSObjects, true);
      dispatch({ type: 'FETCH_SUCCESS', payload: { type: 'FlowProcessBuilder', records } });
    } catch (ex) {
      dispatch({ type: 'FETCH_ERROR', payload: { type: 'FlowProcessBuilder', error: getErrorMessage(ex) } });
    } finally {
      dispatch({ type: 'FETCH_FINISH' });
    }
  }, [defaultApiVersion, selectedOrg, selectedSObjects, trackEvent]);

  // const restoreSnapshot = useCallback((snapshot: TableRowItemSnapshot[]) => {
  //   dispatch({ type: 'RESTORE_SNAPSHOT', payload: { snapshot } });
  // }, []);

  useEffect(() => {
    fetchData();
  }, [defaultApiVersion, fetchData, selectedOrg, selectedSObjects]);

  return {
    loading,
    hasError,
    errorMessage,
    data,
    rows,
    visibleRows,
    fetchData,
    refreshProcessBuilders,
    updateIsActiveFlag,
    toggleRowExpand,
    toggleAll,
    resetChanges,
    tableRowsChange,
    // restoreSnapshot,
    dirtyCount,
  };
}
