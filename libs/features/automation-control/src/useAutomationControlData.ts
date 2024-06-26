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
  | { type: 'RESET' }
  | { type: 'ERROR'; payload?: { errorMessage: string } };

interface State {
  loading: boolean;
  hasError: boolean;
  errorMessage?: string | null;
  data: StateData;
  /** These are the only data points that are updated over time */
  rows: (TableRow | TableRowItem | TableRowItemChild)[];
  visibleRows: (TableRow | TableRowItem | TableRowItemChild)[];
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
      state.keys
        .map((key) => rowsByKey[key])
        .forEach((row) => {
          const key = row.key;
          if (isTableRowItem(row)) {
            rowsByKey[key] = { ...rowsByKey[key], isActive: action.payload.value };
            // see if flow or process builder (only ones with grandchildren)
            if (Array.isArray(row.children)) {
              // set all children to false initially
              row.children.forEach((child) => {
                rowsByKey[child.key] = { ...rowsByKey[child.key], isActive: false };
              });
              // if disable, then remove active version and set all children to disabled
              if (action.payload.value) {
                // set all versions to false, then latest version to true
                const latestVersion = row.children.reduce((maxRow: TableRowItemChild, child) => {
                  if (!maxRow) {
                    return child;
                  }
                  return maxRow.record.VersionNumber > child.record.VersionNumber ? maxRow : child;
                }, row.children[0]);
                // set latest version to true and set active version number on parent
                rowsByKey[latestVersion.key] = { ...rowsByKey[latestVersion.key], isActive: true };
                (rowsByKey[key] as TableRowItem).activeVersionNumber = latestVersion.record.VersionNumber;
              } else {
                (rowsByKey[key] as TableRowItem).activeVersionNumber = null;
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

// TODO: figure out if this should be part of reducer or somewhere else
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
        })
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
        })
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
        })
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
        })
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
                  encodeURIComponent(`/${record.DurableId}?retUrl=/lightning/setup/Flows/home`)
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
            })
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
  rowsByKeyInit: Record<string, TableRow | TableRowItem | TableRowItemChild>
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
  rowsByKey: Record<string, TableRow | TableRowItem | TableRowItemChild>
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
  }, []);

  const toggleAll = useCallback((value: boolean) => {
    dispatch({ type: 'TOGGLE_ALL', payload: { value } });
    trackEvent(ANALYTICS_KEYS.automation_toggle_all, { type: value ? 'all' : 'none' });
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
  }, [defaultApiVersion, selectedOrg, selectedSObjects]);

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
    // restoreSnapshot,
    dirtyCount,
  };
}
