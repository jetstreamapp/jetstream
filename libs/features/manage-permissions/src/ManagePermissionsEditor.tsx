import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { ANALYTICS_KEYS, MIME_TYPES } from '@jetstream/shared/constants';
import { saveFile, tracker, useGoBackShortcut, usePrimaryActionShortcut } from '@jetstream/shared/ui-utils';
import { getErrorMessage, groupByFlat } from '@jetstream/shared/utils';
import {
  AsyncJobNew,
  DirtyRow,
  FieldPermissionDefinitionMap,
  FieldPermissionRecordForSave,
  ManagePermissionsEditorTableRef,
  ObjectPermissionDefinitionMap,
  ObjectPermissionRecordForSave,
  PermissionFieldSaveData,
  PermissionObjectSaveData,
  PermissionSaveResults,
  PermissionSetupEntityAccessSaveData,
  PermissionSystemSaveData,
  PermissionTabVisibilitySaveData,
  PermissionTableFieldCell,
  PermissionTableFieldCellPermission,
  PermissionTableObjectCell,
  PermissionTableObjectCellPermission,
  PermissionTableSetupEntityAccessCell,
  PermissionTableSetupEntityAccessCellPermission,
  PermissionTableSummaryRow,
  PermissionTableSystemPermissionCell,
  PermissionTableTabVisibilityCell,
  PermissionTableTabVisibilityCellPermission,
  SetupEntityAccessDefinitionMap,
  SetupEntityAccessRecordForSave,
  SystemPermissionDefinitionMap,
  SystemPermissionSaveRecord,
  TabVisibilityPermissionDefinitionMap,
  TabVisibilityPermissionRecordForSave,
  UploadToGoogleJob,
} from '@jetstream/types';
import {
  AutoFullHeightContainer,
  ColumnWithFilter,
  ConfirmationModalPromise,
  FileFauxDownloadModal,
  FileFauxDownloadModalProps,
  Icon,
  KeyboardShortcut,
  ScopedNotification,
  Spinner,
  Tabs,
  Toast,
  Toolbar,
  ToolbarItemActions,
  ToolbarItemGroup,
  Tooltip,
  fireToast,
  getModifierKey,
} from '@jetstream/ui';
import { ConfirmPageChange, RequireMetadataApiBanner, fromJetstreamEvents, fromPermissionsState, useAnalytics } from '@jetstream/ui-core';
import { applicationCookieState, googleDriveAccessState, selectedOrgState } from '@jetstream/ui/app-state';
import { useAtom, useAtomValue } from 'jotai';
import { useResetAtom } from 'jotai/utils';
import { Fragment, FunctionComponent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { CreateCustomPermissionModal } from './CreateCustomPermissionModal';
import { FieldAuditColumnsPopover } from './FieldAuditColumnsPopover';
import ManagePermissionsEditorFieldTable from './ManagePermissionsEditorFieldTable';
import ManagePermissionsEditorObjectTable from './ManagePermissionsEditorObjectTable';
import ManagePermissionsEditorSetupEntityAccessTable from './ManagePermissionsEditorSetupEntityAccessTable';
import ManagePermissionsEditorSystemPermissionTable from './ManagePermissionsEditorSystemPermissionTable';
import ManagePermissionsEditorTabVisibilityTable from './ManagePermissionsEditorTabVisibilityTable';
import { usePermissionRecords } from './usePermissionRecords';
import { useVisibleFieldAuditColumns } from './useVisibleFieldAuditColumns';
import { generateCsvFilesFromTable, generateExcelWorkbookFromTable } from './utils/permission-manager-export-utils';
import {
  applySystemPermissionDependencies,
  getConfirmationModalContent,
  getDirtyFieldPermissions,
  getDirtyObjectPermissions,
  getDirtySetupEntityAccessPermissions,
  getDirtySystemPermissions,
  getDirtyTabVisibilityPermissions,
  getFieldColumns,
  getFieldRows,
  getObjectColumns,
  getObjectRows,
  getSetupEntityAccessColumns,
  getSetupEntityAccessRows,
  getSystemPermissionColumns,
  getSystemPermissionRows,
  getTabVisibilityColumns,
  getTabVisibilityRows,
  updateFieldRowsAfterSave,
  updateObjectRowsAfterSave,
  updateSetupEntityAccessRowsAfterSave,
  updateSystemPermissionRowsAfterSave,
  updateTabVisibilityRowsAfterSave,
} from './utils/permission-manager-table-utils';
import {
  clearPermissionErrorMessage,
  collectProfileAndPermissionIds,
  filterPermissionRows,
  getUpdatedFieldPermissions,
  getUpdatedObjectPermissions,
  getUpdatedSystemPermissions,
  getUpdatedTabVisibilityPermissions,
  permissionsHaveError,
  prepareFieldPermissionSaveData,
  prepareObjectPermissionSaveData,
  prepareSystemPermissionSaveData,
  prepareTabVisibilityPermissionSaveData,
  savePermissionRecords,
  saveSystemPermissionRecords,
  updatePermissionSetRecords,
} from './utils/permission-manager-utils';
import {
  CUSTOM_PERMISSION_CATALOG,
  customPermissionToCatalogItem,
  getSetupEntityAccessDefinition,
  getUpdatedSetupEntityAccessPermissions,
  prepareSetupEntityAccessSaveData,
} from './utils/setup-entity-access-utils';

const HEIGHT_BUFFER = 170;

const FIELD_PERMISSIONS_TAB_ID = 'field-permissions';
const SYSTEM_PERMISSIONS_TAB_ID = 'system-permissions';
const CUSTOM_PERMISSIONS_TAB_ID = CUSTOM_PERMISSION_CATALOG.key;
/** Title case of the catalog label, for the column header, tab title and export sheet */
const CUSTOM_PERMISSION_LABEL = 'Custom Permission';
const CUSTOM_PERMISSIONS_LABEL = 'Custom Permissions';

/** Shown in place of the object, tab visibility and field tables when the editor was opened without any objects */
function NoObjectsSelectedNotice() {
  return (
    <ScopedNotification theme="info" className="slds-m-around_medium">
      No objects were selected. Go back and select one or more objects to manage object, tab visibility and field permissions. System
      permissions and custom permissions do not depend on objects and can be managed from their tabs.
    </ScopedNotification>
  );
}

export function ErrorTooltip({ hasError, id, message }: { hasError: boolean; id: string; message?: string }) {
  if (!hasError) {
    return null;
  }
  return (
    <Tooltip
      id={`tooltip-${id}`}
      content={
        <div>
          <strong>{message || 'There were errors saving your data, review the table for more information.'}</strong>
        </div>
      }
    >
      <Icon type="utility" icon="error" className="slds-icon slds-icon-text-error slds-icon_xx-small slds-m-left_small" />
    </Tooltip>
  );
}

export interface ManagePermissionsEditorProps {}

export const ManagePermissionsEditor: FunctionComponent<ManagePermissionsEditorProps> = () => {
  const navigate = useNavigate();
  const { trackEvent } = useAnalytics();
  const isMounted = useRef(true);
  const { google_apiKey, google_appId, google_clientId } = useAtomValue(applicationCookieState);
  const { hasGoogleDriveAccess, googleShowUpgradeToPro } = useAtomValue(googleDriveAccessState);
  const managePermissionsEditorObjectTableRef = useRef<ManagePermissionsEditorTableRef>(null);
  const managePermissionsEditorFieldTableRef = useRef<ManagePermissionsEditorTableRef>(null);
  const managePermissionsEditorSystemPermissionTableRef = useRef<ManagePermissionsEditorTableRef>(null);
  const managePermissionsEditorCustomPermissionTableRef = useRef<ManagePermissionsEditorTableRef>(null);
  const selectedOrg = useAtomValue(selectedOrgState);
  const { defaultApiVersion } = useAtomValue(applicationCookieState);

  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [fileDownloadModalOpen, setFileDownloadModalOpen] = useState<boolean>(false);
  const [createCustomPermissionModalOpen, setCreateCustomPermissionModalOpen] = useState(false);

  const selectedProfiles = useAtomValue(fromPermissionsState.selectedProfilesPermSetState);
  const selectedPermissionSets = useAtomValue(fromPermissionsState.selectedPermissionSetsState);
  const selectedSObjects = useAtomValue(fromPermissionsState.selectedSObjectsState);

  const profilesById = useAtomValue(fromPermissionsState.profilesByIdSelector);
  const permissionSetsById = useAtomValue(fromPermissionsState.permissionSetsByIdSelector);
  const readOnlyPermissionSetIds = useAtomValue(fromPermissionsState.managedPermissionSetIdsSelector);
  const [fieldsByObject, setFieldsByObject] = useAtom(fromPermissionsState.fieldsByObject);
  const [fieldsByKey, setFieldsByKey] = useAtom(fromPermissionsState.fieldsByKey);
  const [objectPermissionMap, setObjectPermissionMap] = useAtom(fromPermissionsState.objectPermissionMap);
  const [fieldPermissionMap, setFieldPermissionMap] = useAtom(fromPermissionsState.fieldPermissionMap);
  const [tabVisibilityPermissionMap, setTabVisibilityPermissionMap] = useAtom(fromPermissionsState.tabVisibilityPermissionMap);
  const [systemPermissionMap, setSystemPermissionMap] = useAtom(fromPermissionsState.systemPermissionMap);
  const [setupEntityAccessPermissionMap, setSetupEntityAccessPermissionMap] = useAtom(fromPermissionsState.setupEntityAccessPermissionMap);
  // Only custom permissions are wired up today; each further setup entity type gets its own tab and state block
  const customPermissionMap = setupEntityAccessPermissionMap?.CustomPermission || null;
  const setCustomPermissionMap = useCallback(
    (permissionMap: Record<string, SetupEntityAccessDefinitionMap>) => {
      setSetupEntityAccessPermissionMap((previousValue) => ({ ...previousValue, CustomPermission: permissionMap }));
    },
    [setSetupEntityAccessPermissionMap],
  );

  const resetFieldsByObject = useResetAtom(fromPermissionsState.fieldsByObject);
  const resetFieldsByKey = useResetAtom(fromPermissionsState.fieldsByKey);
  const resetObjectPermissionMap = useResetAtom(fromPermissionsState.objectPermissionMap);
  const resetFieldPermissionMap = useResetAtom(fromPermissionsState.fieldPermissionMap);
  const resetTabVisibilityPermissionMap = useResetAtom(fromPermissionsState.tabVisibilityPermissionMap);
  const resetSystemPermissionMap = useResetAtom(fromPermissionsState.systemPermissionMap);
  const resetSetupEntityAccessPermissionMap = useResetAtom(fromPermissionsState.setupEntityAccessPermissionMap);

  const { refetchMetadata, ...recordData } = usePermissionRecords(selectedOrg, selectedSObjects, selectedProfiles, selectedPermissionSets);

  const [objectColumns, setObjectColumns] = useState<ColumnWithFilter<PermissionTableObjectCell, PermissionTableSummaryRow>[]>([]);
  const [objectRows, setObjectRows] = useState<PermissionTableObjectCell[] | null>(null);
  const [visibleObjectRows, setVisibleObjectRows] = useState<PermissionTableObjectCell[] | null>(null);
  const [dirtyObjectRows, setDirtyObjectRows] = useState<Record<string, DirtyRow<PermissionTableObjectCell>>>({});
  const [objectFilter, setObjectFilter] = useState('');
  const [objectErrorsOnly, setObjectErrorsOnly] = useState(false);

  const [tabVisibilityColumns, setTabVisibilityColumns] = useState<
    ColumnWithFilter<PermissionTableTabVisibilityCell, PermissionTableSummaryRow>[]
  >([]);
  const [tabVisibilityRows, setTabVisibilityRows] = useState<PermissionTableTabVisibilityCell[] | null>(null);
  const [visibleTabVisibilityRows, setVisibleTabVisibilityRows] = useState<PermissionTableTabVisibilityCell[] | null>(null);
  const [dirtyTabVisibilityRows, setDirtyTabVisibilityRows] = useState<Record<string, DirtyRow<PermissionTableTabVisibilityCell>>>({});
  const [tabVisibilityFilter, setTabVisibilityFilter] = useState('');
  const [tabVisibilityErrorsOnly, setTabVisibilityErrorsOnly] = useState(false);

  const [fieldColumns, setFieldColumns] = useState<ColumnWithFilter<PermissionTableFieldCell, PermissionTableSummaryRow>[]>([]);
  const [fieldRows, setFieldRows] = useState<PermissionTableFieldCell[] | null>(null);
  const [visibleFieldRows, setVisibleFieldRows] = useState<PermissionTableFieldCell[] | null>(null);
  const [dirtyFieldRows, setDirtyFieldRows] = useState<Record<string, DirtyRow<PermissionTableFieldCell>>>({});
  const [fieldFilter, setFieldFilter] = useState('');
  const [fieldErrorsOnly, setFieldErrorsOnly] = useState(false);
  const {
    visibleColumns: visibleFieldAuditColumns,
    toggleColumn: handleToggleFieldAuditColumn,
    toggleAll: handleToggleAllFieldAuditColumns,
    filterColumns: filterVisibleFieldAuditColumns,
  } = useVisibleFieldAuditColumns();

  // Without objects the field tab has nothing to show, so the first tab that does not depend on objects is opened
  const initialTabId = selectedSObjects.length ? FIELD_PERMISSIONS_TAB_ID : SYSTEM_PERMISSIONS_TAB_ID;
  // The audit column toggles only apply to the field table, so the toolbar button is hidden on the other tabs
  const [activeTabId, setActiveTabId] = useState(initialTabId);

  const [systemPermissionColumns, setSystemPermissionColumns] = useState<
    ColumnWithFilter<PermissionTableSystemPermissionCell, PermissionTableSummaryRow>[]
  >([]);
  const [systemPermissionRows, setSystemPermissionRows] = useState<PermissionTableSystemPermissionCell[] | null>(null);
  const [visibleSystemPermissionRows, setVisibleSystemPermissionRows] = useState<PermissionTableSystemPermissionCell[] | null>(null);
  const [dirtySystemPermissionRows, setDirtySystemPermissionRows] = useState<Record<string, DirtyRow<PermissionTableSystemPermissionCell>>>(
    {},
  );
  const [systemPermissionFilter, setSystemPermissionFilter] = useState('');
  const [systemPermissionErrorsOnly, setSystemPermissionErrorsOnly] = useState(false);

  const [customPermissionColumns, setCustomPermissionColumns] = useState<
    ColumnWithFilter<PermissionTableSetupEntityAccessCell, PermissionTableSummaryRow>[]
  >([]);
  const [customPermissionRows, setCustomPermissionRows] = useState<PermissionTableSetupEntityAccessCell[] | null>(null);
  const [visibleCustomPermissionRows, setVisibleCustomPermissionRows] = useState<PermissionTableSetupEntityAccessCell[] | null>(null);
  const [dirtyCustomPermissionRows, setDirtyCustomPermissionRows] = useState<
    Record<string, DirtyRow<PermissionTableSetupEntityAccessCell>>
  >({});
  const [customPermissionFilter, setCustomPermissionFilter] = useState('');
  const [customPermissionErrorsOnly, setCustomPermissionErrorsOnly] = useState(false);

  const [dirtyObjectCount, setDirtyObjectCount] = useState<number>(0);
  const [dirtyFieldCount, setDirtyFieldCount] = useState<number>(0);
  const [dirtyTabVisibilityCount, setDirtyTabVisibilityCount] = useState<number>(0);
  const [dirtySystemPermissionCount, setDirtySystemPermissionCount] = useState<number>(0);
  const [dirtyCustomPermissionCount, setDirtyCustomPermissionCount] = useState<number>(0);
  const [hasModifiedViewAllFields, setHasModifiedViewAllFields] = useState(false);

  const [objectsHaveErrors, setObjectsHaveErrors] = useState<boolean>(false);
  const [fieldsHaveErrors, setFieldsHaveErrors] = useState<boolean>(false);
  const [tabVisibilityHaveErrors, setTabVisibilityHaveErrors] = useState<boolean>(false);
  const [systemPermissionsHaveErrors, setSystemPermissionsHaveErrors] = useState<boolean>(false);
  const [customPermissionsHaveErrors, setCustomPermissionsHaveErrors] = useState<boolean>(false);

  const hasDirtyChanges =
    !!dirtyObjectCount || !!dirtyFieldCount || !!dirtyTabVisibilityCount || !!dirtySystemPermissionCount || !!dirtyCustomPermissionCount;
  const hasAnyErrors =
    objectsHaveErrors || fieldsHaveErrors || tabVisibilityHaveErrors || systemPermissionsHaveErrors || customPermissionsHaveErrors;

  /**
   * `fieldColumns` always holds every column, including the opt-in audit ones - the export path reads the full set
   * straight from the builder. Memoized because the grid re-initializes its filters and clears cell selection
   * whenever the column array identity changes.
   */
  const visibleFieldColumns = useMemo(() => filterVisibleFieldAuditColumns(fieldColumns), [fieldColumns, filterVisibleFieldAuditColumns]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    setFieldsByObject(recordData.fieldsByObject);
    setFieldsByKey(recordData.fieldsByKey);
    setObjectPermissionMap(recordData.objectPermissionMap);
    setFieldPermissionMap(recordData.fieldPermissionMap);
    setTabVisibilityPermissionMap(recordData.tabVisibilityPermissionMap);
    setSystemPermissionMap(recordData.systemPermissionMap);
    setSetupEntityAccessPermissionMap(recordData.setupEntityAccessPermissionMap);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    recordData.fieldsByObject,
    recordData.fieldsByKey,
    recordData.objectPermissionMap,
    recordData.fieldPermissionMap,
    recordData.tabVisibilityPermissionMap,
    recordData.systemPermissionMap,
    recordData.setupEntityAccessPermissionMap,
  ]);

  useEffect(() => {
    setLoading(recordData.loading);
  }, [recordData.loading]);

  useEffect(() => {
    if (
      !loading &&
      !hasLoaded &&
      fieldsByObject &&
      fieldsByKey &&
      objectPermissionMap &&
      fieldPermissionMap &&
      tabVisibilityPermissionMap &&
      systemPermissionMap &&
      customPermissionMap
    ) {
      setHasLoaded(true);
      initTableData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    loading,
    fieldsByObject,
    fieldsByKey,
    objectPermissionMap,
    fieldPermissionMap,
    tabVisibilityPermissionMap,
    systemPermissionMap,
    customPermissionMap,
  ]);

  useEffect(() => {
    setHasError(recordData.hasError);
  }, [recordData.hasError]);

  useEffect(() => {
    if (objectPermissionMap && fieldPermissionMap && tabVisibilityPermissionMap && systemPermissionMap && customPermissionMap) {
      const objectsHaveError = permissionsHaveError(objectPermissionMap);
      const fieldsHaveError = permissionsHaveError(fieldPermissionMap);
      const tabVisibilityHaveError = permissionsHaveError(tabVisibilityPermissionMap);
      const systemPermissionsHaveError = permissionsHaveError(systemPermissionMap);
      const customPermissionsHaveError = permissionsHaveError(customPermissionMap);
      setObjectsHaveErrors(objectsHaveError);
      setFieldsHaveErrors(fieldsHaveError);
      setTabVisibilityHaveErrors(tabVisibilityHaveError);
      setSystemPermissionsHaveErrors(systemPermissionsHaveError);
      setCustomPermissionsHaveErrors(customPermissionsHaveError);
      // The "errors only" toggle is only rendered while a table has errors, so clearing the errors (a successful
      // re-save or a reset) must also clear the filter - otherwise the table stays filtered to zero rows with no
      // control left to turn it back off.
      if (!objectsHaveError) {
        setObjectErrorsOnly(false);
      }
      if (!fieldsHaveError) {
        setFieldErrorsOnly(false);
      }
      if (!tabVisibilityHaveError) {
        setTabVisibilityErrorsOnly(false);
      }
      if (!systemPermissionsHaveError) {
        setSystemPermissionErrorsOnly(false);
      }
      if (!customPermissionsHaveError) {
        setCustomPermissionErrorsOnly(false);
      }
    }
  }, [objectPermissionMap, fieldPermissionMap, tabVisibilityPermissionMap, systemPermissionMap, customPermissionMap]);

  useEffect(() => {
    setDirtyFieldCount(Object.values(dirtyFieldRows).reduce((output, { dirtyCount }) => output + dirtyCount, 0));
  }, [dirtyFieldRows]);

  useEffect(() => {
    setDirtyObjectCount(Object.values(dirtyObjectRows).reduce((output, { dirtyCount }) => output + dirtyCount, 0));
    setHasModifiedViewAllFields(
      Object.values(dirtyObjectRows).some(({ row }) =>
        Object.values(row.permissions).some(({ viewAllFieldsIsDirty }) => viewAllFieldsIsDirty),
      ),
    );
  }, [dirtyObjectRows]);

  useEffect(() => {
    setDirtyTabVisibilityCount(Object.values(dirtyTabVisibilityRows).reduce((output, { dirtyCount }) => output + dirtyCount, 0));
  }, [dirtyTabVisibilityRows]);

  useEffect(() => {
    setDirtySystemPermissionCount(Object.values(dirtySystemPermissionRows).reduce((output, { dirtyCount }) => output + dirtyCount, 0));
  }, [dirtySystemPermissionRows]);

  useEffect(() => {
    setDirtyCustomPermissionCount(Object.values(dirtyCustomPermissionRows).reduce((output, { dirtyCount }) => output + dirtyCount, 0));
  }, [dirtyCustomPermissionRows]);

  useEffect(() => {
    setVisibleFieldRows(filterPermissionRows(fieldRows, fieldFilter, fieldErrorsOnly));
  }, [fieldFilter, fieldRows, fieldErrorsOnly]);

  useEffect(() => {
    setVisibleObjectRows(filterPermissionRows(objectRows, objectFilter, objectErrorsOnly));
  }, [objectFilter, objectRows, objectErrorsOnly]);

  useEffect(() => {
    setVisibleTabVisibilityRows(filterPermissionRows(tabVisibilityRows, tabVisibilityFilter, tabVisibilityErrorsOnly));
  }, [tabVisibilityFilter, tabVisibilityRows, tabVisibilityErrorsOnly]);

  useEffect(() => {
    setVisibleSystemPermissionRows(filterPermissionRows(systemPermissionRows, systemPermissionFilter, systemPermissionErrorsOnly));
  }, [systemPermissionFilter, systemPermissionRows, systemPermissionErrorsOnly]);

  useEffect(() => {
    setVisibleCustomPermissionRows(filterPermissionRows(customPermissionRows, customPermissionFilter, customPermissionErrorsOnly));
  }, [customPermissionFilter, customPermissionRows, customPermissionErrorsOnly]);

  const handleObjectBulkRowUpdate = useCallback((rows: PermissionTableObjectCell[], indexes?: number[]) => {
    const rowsByKey = groupByFlat(rows, 'key');
    setObjectRows((prevRows) => (prevRows ? prevRows?.map((row) => rowsByKey[row.key] || row) : rows));
    indexes = indexes || rows.map((row, index) => index);
    setDirtyObjectRows((priorValue) => {
      const newValues = { ...priorValue };
      indexes?.forEach((rowIndex) => {
        const row = rows[rowIndex];
        const rowKey = row.key; // e.x. Obj__c.Field__c
        const dirtyCount = Object.values(row.permissions).reduce(
          (output, { createIsDirty, readIsDirty, editIsDirty, deleteIsDirty, viewAllIsDirty, modifyAllIsDirty, viewAllFieldsIsDirty }) => {
            output +=
              createIsDirty || readIsDirty || editIsDirty || deleteIsDirty || viewAllIsDirty || modifyAllIsDirty || viewAllFieldsIsDirty
                ? 1
                : 0;
            return output;
          },
          0,
        );
        newValues[rowKey] = { rowKey, dirtyCount, row };
      });
      // remove items with a dirtyCount of 0 to reduce future processing required
      return Object.keys(newValues).reduce((output: Record<string, DirtyRow<PermissionTableObjectCell>>, key) => {
        if (newValues[key].dirtyCount) {
          output[key] = newValues[key];
        }
        return output;
      }, {});
    });
  }, []);

  const handleFieldBulkRowUpdate = useCallback((rows: PermissionTableFieldCell[], indexes?: number[]) => {
    const rowsByKey = groupByFlat(rows, 'key');
    setFieldRows((prevRows) => (prevRows ? prevRows?.map((row) => rowsByKey[row.key] || row) : rows));
    indexes = indexes || rows.map((row, index) => index);
    setDirtyFieldRows((priorValue) => {
      const newValues = { ...priorValue };
      indexes?.forEach((rowIndex) => {
        const row = rows[rowIndex];
        const rowKey = row.key; // e.x. Obj__c.Field__c
        const dirtyCount = Object.values(row.permissions).reduce((output, { readIsDirty, editIsDirty }) => {
          output += readIsDirty || editIsDirty ? 1 : 0;
          return output;
        }, 0);
        newValues[rowKey] = { rowKey, dirtyCount, row };
      });
      // remove items with a dirtyCount of 0 to reduce future processing required
      return Object.keys(newValues).reduce((output: Record<string, DirtyRow<PermissionTableFieldCell>>, key) => {
        if (newValues[key].dirtyCount) {
          output[key] = newValues[key];
        }
        return output;
      }, {});
    });
  }, []);

  const handleTabVisibilityBulkRowUpdate = useCallback((rows: PermissionTableTabVisibilityCell[], indexes?: number[]) => {
    const rowsByKey = groupByFlat(rows, 'key');
    setTabVisibilityRows((prevRows) => (prevRows ? prevRows.map((row) => rowsByKey[row.key] || row) : rows));
    indexes = indexes || rows.map((row, index) => index);
    setDirtyTabVisibilityRows((priorValue) => {
      const newValues = { ...priorValue };
      indexes?.forEach((rowIndex) => {
        const row = rows[rowIndex];
        const rowKey = row.key; // e.x. Obj__c.Field__c
        const dirtyCount = Object.values(row.permissions).reduce((output, { availableIsDirty, visibleIsDirty }) => {
          output += availableIsDirty || visibleIsDirty ? 1 : 0;
          return output;
        }, 0);
        newValues[rowKey] = { rowKey, dirtyCount, row };
      });
      // remove items with a dirtyCount of 0 to reduce future processing required
      return Object.keys(newValues).reduce((output: Record<string, DirtyRow<PermissionTableTabVisibilityCell>>, key) => {
        if (newValues[key].dirtyCount) {
          output[key] = newValues[key];
        }
        return output;
      }, {});
    });
  }, []);

  const handleSystemPermissionBulkRowUpdate = useCallback(
    (changedRows: PermissionTableSystemPermissionCell[]) => {
      const baseRows = systemPermissionRows || [];
      // cascade Salesforce dependency rules across rows (enable requirements / disable dependents)
      const { rows: mergedRows, affectedKeys } = applySystemPermissionDependencies(baseRows, changedRows);
      const mergedByKey = groupByFlat(mergedRows, 'key');
      setSystemPermissionRows(mergedRows);
      setDirtySystemPermissionRows((priorValue) => {
        const newValues = { ...priorValue };
        affectedKeys.forEach((rowKey) => {
          const row = mergedByKey[rowKey];
          if (!row) {
            return;
          }
          const dirtyCount = Object.values(row.permissions).reduce((output, { enabledIsDirty }) => output + (enabledIsDirty ? 1 : 0), 0);
          newValues[rowKey] = { rowKey, dirtyCount, row };
        });
        // remove items with a dirtyCount of 0 to reduce future processing required
        return Object.keys(newValues).reduce((output: Record<string, DirtyRow<PermissionTableSystemPermissionCell>>, key) => {
          if (newValues[key].dirtyCount) {
            output[key] = newValues[key];
          }
          return output;
        }, {});
      });
    },
    [systemPermissionRows],
  );

  const handleCustomPermissionBulkRowUpdate = useCallback((rows: PermissionTableSetupEntityAccessCell[], indexes?: number[]) => {
    const rowsByKey = groupByFlat(rows, 'key');
    setCustomPermissionRows((prevRows) => (prevRows ? prevRows.map((row) => rowsByKey[row.key] || row) : rows));
    indexes = indexes || rows.map((row, index) => index);
    setDirtyCustomPermissionRows((priorValue) => {
      const newValues = { ...priorValue };
      indexes?.forEach((rowIndex) => {
        const row = rows[rowIndex];
        const rowKey = row.key; // the setup entity id
        const dirtyCount = Object.values(row.permissions).reduce((output, { enabledIsDirty }) => output + (enabledIsDirty ? 1 : 0), 0);
        newValues[rowKey] = { rowKey, dirtyCount, row };
      });
      // remove items with a dirtyCount of 0 to reduce future processing required
      return Object.keys(newValues).reduce((output: Record<string, DirtyRow<PermissionTableSetupEntityAccessCell>>, key) => {
        if (newValues[key].dirtyCount) {
          output[key] = newValues[key];
        }
        return output;
      }, {});
    });
  }, []);

  function initTableData(
    includeColumns = true,
    objectPermissionMapOverride?: Record<string, ObjectPermissionDefinitionMap>,
    fieldPermissionMapOverride?: Record<string, FieldPermissionDefinitionMap>,
    tabVisibilityPermissionMapOverride?: Record<string, TabVisibilityPermissionDefinitionMap>,
    systemPermissionMapOverride?: Record<string, SystemPermissionDefinitionMap>,
    customPermissionMapOverride?: Record<string, SetupEntityAccessDefinitionMap>,
  ) {
    if (includeColumns) {
      setObjectColumns(
        getObjectColumns(selectedProfiles, selectedPermissionSets, profilesById, permissionSetsById, readOnlyPermissionSetIds),
      );
      setFieldColumns(
        getFieldColumns(selectedProfiles, selectedPermissionSets, profilesById, permissionSetsById, readOnlyPermissionSetIds),
      );
      setTabVisibilityColumns(
        getTabVisibilityColumns(selectedProfiles, selectedPermissionSets, profilesById, permissionSetsById, readOnlyPermissionSetIds),
      );
      setSystemPermissionColumns(
        getSystemPermissionColumns(selectedProfiles, selectedPermissionSets, profilesById, permissionSetsById, readOnlyPermissionSetIds),
      );
      setCustomPermissionColumns(getCustomPermissionColumns());
    }
    const tempObjectRows = getObjectRows(selectedSObjects, objectPermissionMapOverride || objectPermissionMap || {});
    setObjectRows(tempObjectRows);
    setVisibleObjectRows(tempObjectRows);
    setDirtyObjectRows({});

    const tempFieldRows = getFieldRows(selectedSObjects, fieldsByObject || {}, fieldPermissionMapOverride || fieldPermissionMap || {});
    setFieldRows(tempFieldRows);
    setVisibleFieldRows(tempFieldRows);
    setDirtyFieldRows({});

    const tempTabVisibilityRows = getTabVisibilityRows(
      selectedSObjects,
      tabVisibilityPermissionMapOverride || tabVisibilityPermissionMap || {},
    );
    setTabVisibilityRows(tempTabVisibilityRows);
    setVisibleTabVisibilityRows(tempTabVisibilityRows);
    setDirtyTabVisibilityRows({});

    const tempSystemPermissionRows = getSystemPermissionRows(systemPermissionMapOverride || systemPermissionMap || {});
    setSystemPermissionRows(tempSystemPermissionRows);
    setVisibleSystemPermissionRows(tempSystemPermissionRows);
    setDirtySystemPermissionRows({});

    const tempCustomPermissionRows = getSetupEntityAccessRows(customPermissionMapOverride || customPermissionMap || {});
    setCustomPermissionRows(tempCustomPermissionRows);
    setVisibleCustomPermissionRows(tempCustomPermissionRows);
    setDirtyCustomPermissionRows({});
  }

  function getCustomPermissionColumns() {
    return getSetupEntityAccessColumns(
      CUSTOM_PERMISSION_LABEL,
      selectedProfiles,
      selectedPermissionSets,
      profilesById,
      permissionSetsById,
      readOnlyPermissionSetIds,
    );
  }

  /** Export data for every setup entity access tab, built fresh because a tab may never have rendered */
  function getSetupEntityAccessExportData() {
    return [
      {
        sheetName: CUSTOM_PERMISSIONS_LABEL,
        fileName: CUSTOM_PERMISSION_CATALOG.key,
        rowLabel: CUSTOM_PERMISSION_LABEL,
        columns: getCustomPermissionColumns(),
        rows: getSetupEntityAccessRows(customPermissionMap || {}),
      },
    ];
  }

  /**
   * A custom permission created from the editor is added to the loaded data in place (unchecked everywhere) instead of
   * reloading, which would discard unsaved changes on the other tabs.
   */
  function handleCustomPermissionCreated(record: Parameters<typeof customPermissionToCatalogItem>[0]) {
    setCreateCustomPermissionModalOpen(false);
    const definition = getSetupEntityAccessDefinition(
      'CustomPermission',
      customPermissionToCatalogItem(record),
      selectedProfiles,
      selectedPermissionSets,
      {},
      readOnlyPermissionSetIds,
    );
    const updatedMap = { ...customPermissionMap, [definition.setupEntityId]: definition };
    setCustomPermissionMap(updatedMap);
    // Rebuild from the map so the new row lands in sorted position; unsaved edits on this tab are carried over
    const dirtyRowsByKey = Object.values(dirtyCustomPermissionRows).reduce(
      (output: Record<string, PermissionTableSetupEntityAccessCell>, { row }) => {
        output[row.key] = row;
        return output;
      },
      {},
    );
    const rows = getSetupEntityAccessRows(updatedMap).map((row) => dirtyRowsByKey[row.key] || row);
    setCustomPermissionRows(rows);
    setCustomPermissionFilter('');
    trackEvent(ANALYTICS_KEYS.permission_manager_custom_permission_created);
  }

  function exportChanges() {
    setFileDownloadModalOpen(true);
  }

  const handleExport: FileFauxDownloadModalProps['onDownload'] = async ({
    fileFormat,
    fileName,
    mimeType,
    uploadToGoogle,
    googleFolder,
  }) => {
    try {
      // generate brand-new columns/rows just for export
      // This is required in the case where a tab may not have been rendered
      switch (fileFormat) {
        case 'xlsx':
        case 'gdrive': {
          const fileData = generateExcelWorkbookFromTable(
            {
              columns: getObjectColumns(
                selectedProfiles,
                selectedPermissionSets,
                profilesById,
                permissionSetsById,
                readOnlyPermissionSetIds,
              ),
              rows: getObjectRows(selectedSObjects, objectPermissionMap || {}),
            },
            {
              columns: getTabVisibilityColumns(
                selectedProfiles,
                selectedPermissionSets,
                profilesById,
                permissionSetsById,
                readOnlyPermissionSetIds,
              ),
              rows: getTabVisibilityRows(selectedSObjects, tabVisibilityPermissionMap || {}),
            },
            {
              columns: getFieldColumns(
                selectedProfiles,
                selectedPermissionSets,
                profilesById,
                permissionSetsById,
                readOnlyPermissionSetIds,
              ),
              rows: getFieldRows(selectedSObjects, fieldsByObject || {}, fieldPermissionMap || {}),
            },
            {
              columns: getSystemPermissionColumns(
                selectedProfiles,
                selectedPermissionSets,
                profilesById,
                permissionSetsById,
                readOnlyPermissionSetIds,
              ),
              rows: getSystemPermissionRows(systemPermissionMap || {}),
            },
            getSetupEntityAccessExportData(),
          );

          if (uploadToGoogle) {
            const jobs: AsyncJobNew<UploadToGoogleJob>[] = [
              {
                type: 'UploadToGoogle',
                title: `Upload to Google`,
                org: selectedOrg,
                meta: { fileName, fileData, fileType: 'xlsx', googleFolder },
              },
            ];
            fromJetstreamEvents.emit({ type: 'newJob', payload: jobs });
          } else {
            saveFile(fileData, `${fileName}.${fileFormat}`, mimeType);
          }
          break;
        }
        case 'csv': {
          const zipFile = await generateCsvFilesFromTable(
            {
              columns: getObjectColumns(
                selectedProfiles,
                selectedPermissionSets,
                profilesById,
                permissionSetsById,
                readOnlyPermissionSetIds,
              ),
              rows: getObjectRows(selectedSObjects, objectPermissionMap || {}),
            },
            {
              columns: getTabVisibilityColumns(
                selectedProfiles,
                selectedPermissionSets,
                profilesById,
                permissionSetsById,
                readOnlyPermissionSetIds,
              ),
              rows: getTabVisibilityRows(selectedSObjects, tabVisibilityPermissionMap || {}),
            },
            {
              columns: getFieldColumns(
                selectedProfiles,
                selectedPermissionSets,
                profilesById,
                permissionSetsById,
                readOnlyPermissionSetIds,
              ),
              rows: getFieldRows(selectedSObjects, fieldsByObject || {}, fieldPermissionMap || {}),
            },
            {
              columns: getSystemPermissionColumns(
                selectedProfiles,
                selectedPermissionSets,
                profilesById,
                permissionSetsById,
                readOnlyPermissionSetIds,
              ),
              rows: getSystemPermissionRows(systemPermissionMap || {}),
            },
            getSetupEntityAccessExportData(),
          );
          saveFile(zipFile, `${fileName}.zip`, MIME_TYPES.ZIP);
          break;
        }
        case 'json':
        case 'xml':
        case 'zip':
        default:
          throw new Error('A valid file type type has not been selected');
      }

      setFileDownloadModalOpen(false);
    } catch (ex) {
      logger.error('Error exporting permission data', ex);
      tracker.error('Error exporting permission data', ex);
      fireToast({ message: `There was an error preparing the data for export: ${getErrorMessage(ex)}`, type: 'error' });
    }
  };

  async function saveChanges() {
    if (
      await ConfirmationModalPromise({
        header: 'Confirmation',
        confirm: 'Save Changes',
        content: getConfirmationModalContent(dirtyObjectCount, dirtyFieldCount, dirtyTabVisibilityCount, dirtySystemPermissionCount, [
          { label: CUSTOM_PERMISSION_LABEL, count: dirtyCustomPermissionCount },
        ]),
      })
    ) {
      setLoading(true);
      try {
        let objectPermissionData: PermissionObjectSaveData | undefined = undefined;
        let fieldPermissionData: PermissionFieldSaveData | undefined = undefined;
        let tabVisibilityPermissionData: PermissionTabVisibilitySaveData | undefined = undefined;
        let systemPermissionData: PermissionSystemSaveData | undefined = undefined;
        let customPermissionData: PermissionSetupEntityAccessSaveData | undefined = undefined;
        const profileIds = new Set<string>();
        const permissionSetIds = new Set<string>();

        if (dirtyObjectCount) {
          const dirtyPermissions = getDirtyObjectPermissions(dirtyObjectRows);
          if (dirtyPermissions.length > 0) {
            objectPermissionData = prepareObjectPermissionSaveData(dirtyPermissions);
            const ids = collectProfileAndPermissionIds(dirtyPermissions, profilesById, permissionSetsById);
            ids.profileIds.forEach((id) => profileIds.add(id));
            ids.permissionSetIds.forEach((id) => permissionSetIds.add(id));
          }
        }
        if (dirtyFieldCount) {
          const dirtyPermissions = getDirtyFieldPermissions(dirtyFieldRows);
          if (dirtyPermissions.length > 0) {
            fieldPermissionData = prepareFieldPermissionSaveData(dirtyPermissions);
            const ids = collectProfileAndPermissionIds(dirtyPermissions, profilesById, permissionSetsById);
            ids.profileIds.forEach((id) => profileIds.add(id));
            ids.permissionSetIds.forEach((id) => permissionSetIds.add(id));
          }
        }
        if (dirtyTabVisibilityCount) {
          const dirtyPermissions = getDirtyTabVisibilityPermissions(dirtyTabVisibilityRows);
          if (dirtyPermissions.length > 0) {
            tabVisibilityPermissionData = prepareTabVisibilityPermissionSaveData(dirtyPermissions);
            const ids = collectProfileAndPermissionIds(dirtyPermissions, profilesById, permissionSetsById);
            ids.profileIds.forEach((id) => profileIds.add(id));
            ids.permissionSetIds.forEach((id) => permissionSetIds.add(id));
          }
        }
        if (dirtySystemPermissionCount) {
          const dirtyPermissions = getDirtySystemPermissions(dirtySystemPermissionRows);
          if (dirtyPermissions.length > 0) {
            systemPermissionData = prepareSystemPermissionSaveData(dirtyPermissions, profilesById, permissionSetsById);
            const ids = collectProfileAndPermissionIds(dirtyPermissions, profilesById, permissionSetsById);
            ids.profileIds.forEach((id) => profileIds.add(id));
            ids.permissionSetIds.forEach((id) => permissionSetIds.add(id));
          }
        }
        if (dirtyCustomPermissionCount) {
          const dirtyPermissions = getDirtySetupEntityAccessPermissions(dirtyCustomPermissionRows);
          if (dirtyPermissions.length > 0) {
            customPermissionData = prepareSetupEntityAccessSaveData(dirtyPermissions);
            const ids = collectProfileAndPermissionIds(dirtyPermissions, profilesById, permissionSetsById);
            ids.profileIds.forEach((id) => profileIds.add(id));
            ids.permissionSetIds.forEach((id) => permissionSetIds.add(id));
          }
        }

        let objectSaveResults: PermissionSaveResults<ObjectPermissionRecordForSave, PermissionTableObjectCellPermission>[] | undefined =
          undefined;
        let fieldSaveResults: PermissionSaveResults<FieldPermissionRecordForSave, PermissionTableFieldCellPermission>[] | undefined =
          undefined;
        let tabVisibilitySaveResults:
          | PermissionSaveResults<TabVisibilityPermissionRecordForSave, PermissionTableTabVisibilityCellPermission>[]
          | undefined = undefined;
        let systemSaveResults: SystemPermissionSaveRecord[] | undefined = undefined;
        let customPermissionSaveResults:
          | PermissionSaveResults<SetupEntityAccessRecordForSave, PermissionTableSetupEntityAccessCellPermission>[]
          | undefined = undefined;

        if (objectPermissionData) {
          objectSaveResults = await savePermissionRecords<ObjectPermissionRecordForSave, PermissionTableObjectCellPermission>(
            selectedOrg,
            'ObjectPermissions',
            objectPermissionData,
          );
          logger.log({ objectSaveResults });
        }
        if (fieldPermissionData) {
          fieldSaveResults = await savePermissionRecords<FieldPermissionRecordForSave, PermissionTableFieldCellPermission>(
            selectedOrg,
            'FieldPermissions',
            fieldPermissionData,
          );
          logger.log({ fieldSaveResults });
        }

        if (tabVisibilityPermissionData) {
          tabVisibilitySaveResults = await savePermissionRecords<
            TabVisibilityPermissionRecordForSave,
            PermissionTableTabVisibilityCellPermission
          >(selectedOrg, 'PermissionSetTabSetting', tabVisibilityPermissionData);
          logger.log({ tabVisibilitySaveResults });
        }
        if (systemPermissionData) {
          systemSaveResults = await saveSystemPermissionRecords(selectedOrg, systemPermissionData);
          logger.log({ systemSaveResults });
        }
        if (customPermissionData) {
          customPermissionSaveResults = await savePermissionRecords<
            SetupEntityAccessRecordForSave,
            PermissionTableSetupEntityAccessCellPermission
          >(selectedOrg, 'SetupEntityAccess', customPermissionData);
          logger.log({ customPermissionSaveResults });
        }

        // Update records so that SFDX is aware of the changes
        try {
          await updatePermissionSetRecords(selectedOrg, {
            permissionSetIds: Array.from(permissionSetIds),
            profileIds: Array.from(profileIds),
          });
        } catch (ex) {
          logger.error('Error flagging permission sets as updated', ex);
        }

        if (isMounted.current) {
          if (objectSaveResults && objectPermissionMap && objectRows) {
            const permissionsMap = getUpdatedObjectPermissions(objectPermissionMap, objectSaveResults);
            const rows = updateObjectRowsAfterSave(objectRows, permissionsMap);
            setObjectPermissionMap(permissionsMap);
            setObjectRows(rows);
            handleObjectBulkRowUpdate(rows);
          }
          if (fieldSaveResults && fieldPermissionMap && fieldRows) {
            const permissionsMap = getUpdatedFieldPermissions(fieldPermissionMap, fieldSaveResults);
            const rows = updateFieldRowsAfterSave(fieldRows, permissionsMap);
            setFieldPermissionMap(permissionsMap);
            setFieldRows(rows);
            handleFieldBulkRowUpdate(rows);
          }
          if (tabVisibilitySaveResults && tabVisibilityPermissionMap && tabVisibilityRows) {
            const permissionsMap = getUpdatedTabVisibilityPermissions(tabVisibilityPermissionMap, tabVisibilitySaveResults);
            const rows = updateTabVisibilityRowsAfterSave(tabVisibilityRows, permissionsMap);
            setTabVisibilityPermissionMap(permissionsMap);
            setTabVisibilityRows(rows);
            handleTabVisibilityBulkRowUpdate(rows);
          }
          if (systemSaveResults && systemPermissionMap && systemPermissionRows) {
            const permissionsMap = getUpdatedSystemPermissions(systemPermissionMap, systemSaveResults);
            const rows = updateSystemPermissionRowsAfterSave(systemPermissionRows, permissionsMap);
            setSystemPermissionMap(permissionsMap);
            setSystemPermissionRows(rows);
            handleSystemPermissionBulkRowUpdate(rows);
          }
          if (customPermissionSaveResults && customPermissionMap && customPermissionRows) {
            const permissionsMap = getUpdatedSetupEntityAccessPermissions(customPermissionMap, customPermissionSaveResults);
            const rows = updateSetupEntityAccessRowsAfterSave(customPermissionRows, permissionsMap);
            setCustomPermissionMap(permissionsMap);
            setCustomPermissionRows(rows);
            handleCustomPermissionBulkRowUpdate(rows);
          }
          setLoading(false);
        }
        trackEvent(ANALYTICS_KEYS.permission_manager_saved, {
          dirtyObjectCount,
          dirtyFieldCount,
          dirtyTabVisibilityCount,
          dirtySystemPermissionCount,
          dirtyCustomPermissionCount,
        });
      } catch (ex) {
        logger.error('Error saving permissions', ex);
        tracker.error('Error saving permissions', ex, {
          dirtyObjectCount,
          dirtyFieldCount,
          dirtyTabVisibilityCount,
          dirtySystemPermissionCount,
          dirtyCustomPermissionCount,
        });
        if (isMounted.current) {
          fireToast({
            message: `There was an error saving permissions: ${getErrorMessage(ex)}. Some changes may have been saved — reload to verify.`,
            type: 'error',
          });
          setLoading(false);
        }
      }
    } else {
      trackEvent(ANALYTICS_KEYS.permission_manager_save_cancelled);
    }
  }

  async function reloadPermissions() {
    setHasLoaded(false);
    // Clearing `hasLoaded` unmounts `Tabs`, which remounts on `initialActiveId` without firing `onChange`, so the
    // mirrored tab id is reset alongside it or the field-only toolbar controls stay hidden after a reload.
    setActiveTabId(initialTabId);
    await refetchMetadata();
    trackEvent(ANALYTICS_KEYS.permission_manager_reload);
  }

  function resetChanges() {
    const updatedObjectPermissionMap = clearPermissionErrorMessage(objectPermissionMap || {});
    const updatedFieldPermissionMap = clearPermissionErrorMessage(fieldPermissionMap || {});
    const updatedTabVisibilityPermissionMap = clearPermissionErrorMessage(tabVisibilityPermissionMap || {});
    const updatedSystemPermissionMap = clearPermissionErrorMessage(systemPermissionMap || {});
    const updatedCustomPermissionMap = clearPermissionErrorMessage(customPermissionMap || {});
    setObjectPermissionMap(updatedObjectPermissionMap);
    setFieldPermissionMap(updatedFieldPermissionMap);
    setTabVisibilityPermissionMap(updatedTabVisibilityPermissionMap);
    setSystemPermissionMap(updatedSystemPermissionMap);
    setCustomPermissionMap(updatedCustomPermissionMap);
    initTableData(
      false,
      updatedObjectPermissionMap,
      updatedFieldPermissionMap,
      updatedTabVisibilityPermissionMap,
      updatedSystemPermissionMap,
      updatedCustomPermissionMap,
    );
    trackEvent(ANALYTICS_KEYS.permission_manager_reset);
  }

  function handleGoBack() {
    resetFieldsByObject();
    resetFieldsByKey();
    resetObjectPermissionMap();
    resetFieldPermissionMap();
    resetTabVisibilityPermissionMap();
    resetSystemPermissionMap();
    resetSetupEntityAccessPermissionMap();
  }

  usePrimaryActionShortcut(saveChanges, {
    disabled: loading || !hasDirtyChanges,
  });

  useGoBackShortcut(() => {
    handleGoBack();
    navigate('..');
  }, {});

  return (
    <div>
      <ConfirmPageChange actionInProgress={loading} />
      {fileDownloadModalOpen && (
        <FileFauxDownloadModal
          modalHeader="Download Permissions"
          org={selectedOrg}
          googleIntegrationEnabled={hasGoogleDriveAccess}
          googleShowUpgradeToPro={googleShowUpgradeToPro}
          google_apiKey={google_apiKey}
          google_appId={google_appId}
          google_clientId={google_clientId}
          fileNameParts={['permissions', 'export']}
          allowedTypes={['csv', 'xlsx', 'gdrive']}
          onCancel={() => setFileDownloadModalOpen(false)}
          onDownload={handleExport}
          source="manage_permissions"
          trackEvent={trackEvent}
        />
      )}
      {createCustomPermissionModalOpen && (
        <CreateCustomPermissionModal
          selectedOrg={selectedOrg}
          apiVersion={defaultApiVersion}
          onClose={() => setCreateCustomPermissionModalOpen(false)}
          onCreated={handleCustomPermissionCreated}
        />
      )}
      <RequireMetadataApiBanner />
      <Toolbar>
        <ToolbarItemGroup>
          <Tooltip
            openDelay={500}
            content={
              <div className="slds-p-bottom_small">
                <KeyboardShortcut inverse keys={[getModifierKey(), 'shift', 'enter']} />
              </div>
            }
          >
            <Link className="slds-button slds-button_brand" to=".." onClick={handleGoBack}>
              <Icon type="utility" icon="back" className="slds-button__icon slds-button__icon_left" omitContainer />
              Go Back
            </Link>
          </Tooltip>
        </ToolbarItemGroup>
        <ToolbarItemActions>
          {hasLoaded && activeTabId === CUSTOM_PERMISSIONS_TAB_ID && !recordData.setupEntityAccessUnavailable.CustomPermission && (
            <button
              className="slds-button slds-button_neutral collapsible-button collapsible-button-xs"
              onClick={() => setCreateCustomPermissionModalOpen(true)}
              disabled={loading}
            >
              <Icon type="utility" icon="add" className="slds-button__icon slds-button__icon_left" />
              <span>New Custom Permission</span>
            </button>
          )}
          {hasLoaded && activeTabId === FIELD_PERMISSIONS_TAB_ID && (
            <FieldAuditColumnsPopover
              visibleColumns={visibleFieldAuditColumns}
              dataUnavailable={recordData.fieldAuditUnavailable}
              onToggle={handleToggleFieldAuditColumn}
              onToggleAll={handleToggleAllFieldAuditColumns}
            />
          )}
          <button
            className="slds-button slds-button_neutral collapsible-button collapsible-button-xs"
            onClick={reloadPermissions}
            disabled={loading}
          >
            <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" />
            <span>Reload All Permissions</span>
          </button>
          <button
            className="slds-button slds-button_neutral collapsible-button collapsible-button-xs"
            onClick={resetChanges}
            disabled={loading || (!hasDirtyChanges && !hasAnyErrors)}
          >
            <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" />
            <span>Reset Changes</span>
          </button>
          <button
            className="slds-button slds-button_neutral collapsible-button collapsible-button-xs"
            onClick={exportChanges}
            disabled={loading || hasError}
            title="Export"
          >
            <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" />
            <span>Export</span>
          </button>
          <Tooltip
            openDelay={500}
            content={
              <div className="slds-p-bottom_small">
                <KeyboardShortcut inverse keys={[getModifierKey(), 'enter']} />
              </div>
            }
          >
            <button
              className="slds-button slds-button_brand slds-m-left_xx-small"
              onClick={saveChanges}
              disabled={loading || !hasDirtyChanges}
            >
              <Icon type="utility" icon="upload" className="slds-button__icon slds-button__icon_left" />
              Save
            </button>
          </Tooltip>
        </ToolbarItemActions>
      </Toolbar>
      <AutoFullHeightContainer
        baseCss={css`
          background-color: var(--slds-g-color-surface-container-1, #ffffff);
        `}
        bottomBuffer={10}
        className="slds-scrollable_none"
        bufferIfNotRendered={HEIGHT_BUFFER}
      >
        {loading && <Spinner />}
        {hasError && <Toast type="error">Uh Oh. There was a problem getting the permission data from Salesforce.</Toast>}
        {hasModifiedViewAllFields && (
          <ScopedNotification theme="info">
            After saving "View All Fields" object permission, you will need to reload all permissions before changing field permissions for
            that object.
          </ScopedNotification>
        )}
        {hasLoaded && (
          <Tabs
            initialActiveId={initialTabId}
            onChange={setActiveTabId}
            tabs={[
              {
                id: 'object-permissions',
                title: (
                  <Fragment>
                    <span className="slds-tabs__left-icon">
                      <Icon
                        type="standard"
                        icon="entity"
                        containerClassname="slds-icon_container slds-icon-standard-entity"
                        className="slds-icon slds-icon_small"
                      />
                    </span>
                    Object Permissions {dirtyObjectCount ? `(${dirtyObjectCount})` : ''}
                    <ErrorTooltip hasError={objectsHaveErrors} id="object-errors" />
                  </Fragment>
                ),
                titleText: 'Object Permissions',
                disabled: true,
                content: !selectedSObjects.length ? (
                  <NoObjectsSelectedNotice />
                ) : (
                  <ManagePermissionsEditorObjectTable
                    ref={managePermissionsEditorObjectTableRef}
                    columns={objectColumns}
                    rows={visibleObjectRows || []}
                    totalCount={objectRows?.length || 0}
                    filterText={objectFilter}
                    hasErrors={objectsHaveErrors}
                    errorsOnly={objectErrorsOnly}
                    onFilter={setObjectFilter}
                    onToggleErrorsOnly={setObjectErrorsOnly}
                    onBulkUpdate={handleObjectBulkRowUpdate}
                    onDirtyRows={setDirtyObjectRows}
                  />
                ),
              },

              {
                id: 'tab-visibility-permissions',
                title: (
                  <Fragment>
                    <span className="slds-tabs__left-icon">
                      <Icon
                        type="standard"
                        icon="portal_roles_and_subordinates"
                        containerClassname="slds-icon_container slds-icon-standard-portal-roles-and-subordinates"
                        className="slds-icon slds-icon_small"
                      />
                    </span>
                    Tab Visibility {dirtyTabVisibilityCount ? `(${dirtyTabVisibilityCount})` : ''}
                    <ErrorTooltip hasError={tabVisibilityHaveErrors} id="tab-visibility-errors" />
                  </Fragment>
                ),
                titleText: 'Tab Visibility',
                disabled: true,
                content: !selectedSObjects.length ? (
                  <NoObjectsSelectedNotice />
                ) : (
                  <ManagePermissionsEditorTabVisibilityTable
                    ref={managePermissionsEditorObjectTableRef}
                    columns={tabVisibilityColumns}
                    rows={visibleTabVisibilityRows || []}
                    totalCount={tabVisibilityRows?.length || 0}
                    filterText={tabVisibilityFilter}
                    hasErrors={tabVisibilityHaveErrors}
                    errorsOnly={tabVisibilityErrorsOnly}
                    onFilter={setTabVisibilityFilter}
                    onToggleErrorsOnly={setTabVisibilityErrorsOnly}
                    onBulkUpdate={handleTabVisibilityBulkRowUpdate}
                    onDirtyRows={setDirtyTabVisibilityRows}
                  />
                ),
              },

              {
                id: FIELD_PERMISSIONS_TAB_ID,
                title: (
                  <Fragment>
                    <span className="slds-tabs__left-icon">
                      <Icon
                        type="standard"
                        icon="multi_picklist"
                        containerClassname="slds-icon_container slds-icon-standard-multi-picklist"
                        className="slds-icon slds-icon_small"
                      />
                    </span>
                    Field Permissions {dirtyFieldCount ? `(${dirtyFieldCount})` : ''}
                    <ErrorTooltip hasError={fieldsHaveErrors} id="field-errors" />
                  </Fragment>
                ),
                titleText: 'Field Permissions',
                content: !selectedSObjects.length ? (
                  <NoObjectsSelectedNotice />
                ) : (
                  <ManagePermissionsEditorFieldTable
                    ref={managePermissionsEditorFieldTableRef}
                    columns={visibleFieldColumns}
                    rows={visibleFieldRows || []}
                    totalCount={fieldRows?.length || 0}
                    filterText={fieldFilter}
                    hasErrors={fieldsHaveErrors}
                    errorsOnly={fieldErrorsOnly}
                    onFilter={setFieldFilter}
                    onToggleErrorsOnly={setFieldErrorsOnly}
                    onBulkUpdate={handleFieldBulkRowUpdate}
                    onDirtyRows={setDirtyFieldRows}
                  />
                ),
              },

              {
                id: SYSTEM_PERMISSIONS_TAB_ID,
                title: (
                  <Fragment>
                    <span className="slds-tabs__left-icon">
                      <Icon
                        type="standard"
                        icon="settings"
                        containerClassname="slds-icon_container slds-icon-standard-settings"
                        className="slds-icon slds-icon_small"
                      />
                    </span>
                    System Permissions {dirtySystemPermissionCount ? `(${dirtySystemPermissionCount})` : ''}
                    <ErrorTooltip hasError={systemPermissionsHaveErrors} id="system-permission-errors" />
                    <ErrorTooltip
                      hasError={recordData.systemPermissionsUnavailable}
                      id="system-permission-unavailable"
                      message="System permissions could not be loaded from Salesforce."
                    />
                  </Fragment>
                ),
                titleText: 'System Permissions',
                // System permissions load on their own, so they can fail while every other tab is fine
                content: recordData.systemPermissionsUnavailable ? (
                  <ScopedNotification theme="error" className="slds-m-around_medium">
                    System permissions could not be loaded from Salesforce, so they cannot be viewed or changed here. Every other tab loaded
                    normally. Use <strong>Reload All Permissions</strong> to try again.
                  </ScopedNotification>
                ) : (
                  <ManagePermissionsEditorSystemPermissionTable
                    ref={managePermissionsEditorSystemPermissionTableRef}
                    columns={systemPermissionColumns}
                    rows={visibleSystemPermissionRows || []}
                    totalCount={systemPermissionRows?.length || 0}
                    filterText={systemPermissionFilter}
                    hasErrors={systemPermissionsHaveErrors}
                    errorsOnly={systemPermissionErrorsOnly}
                    onFilter={setSystemPermissionFilter}
                    onToggleErrorsOnly={setSystemPermissionErrorsOnly}
                    onBulkUpdate={handleSystemPermissionBulkRowUpdate}
                    onDirtyRows={setDirtySystemPermissionRows}
                  />
                ),
              },

              {
                id: CUSTOM_PERMISSIONS_TAB_ID,
                title: (
                  <Fragment>
                    <span className="slds-tabs__left-icon">
                      <Icon
                        type="standard"
                        icon="custom"
                        containerClassname="slds-icon_container slds-icon-standard-custom"
                        className="slds-icon slds-icon_small"
                      />
                    </span>
                    {CUSTOM_PERMISSIONS_LABEL} {dirtyCustomPermissionCount ? `(${dirtyCustomPermissionCount})` : ''}
                    <ErrorTooltip hasError={customPermissionsHaveErrors} id="custom-permission-errors" />
                    <ErrorTooltip
                      hasError={!!recordData.setupEntityAccessUnavailable.CustomPermission}
                      id="custom-permission-unavailable"
                      message="Custom permissions could not be loaded from Salesforce."
                    />
                  </Fragment>
                ),
                titleText: CUSTOM_PERMISSIONS_LABEL,
                // Custom permissions load on their own, so they can fail while every other tab is fine
                content: recordData.setupEntityAccessUnavailable.CustomPermission ? (
                  <ScopedNotification theme="error" className="slds-m-around_medium">
                    Custom permissions could not be loaded from Salesforce, so they cannot be viewed or changed here. Every other tab loaded
                    normally. Use <strong>Reload All Permissions</strong> to try again.
                  </ScopedNotification>
                ) : (
                  <ManagePermissionsEditorSetupEntityAccessTable
                    ref={managePermissionsEditorCustomPermissionTableRef}
                    setupEntityType="CustomPermission"
                    columns={customPermissionColumns}
                    rows={visibleCustomPermissionRows || []}
                    totalCount={customPermissionRows?.length || 0}
                    filterText={customPermissionFilter}
                    hasErrors={customPermissionsHaveErrors}
                    errorsOnly={customPermissionErrorsOnly}
                    onFilter={setCustomPermissionFilter}
                    onToggleErrorsOnly={setCustomPermissionErrorsOnly}
                    onBulkUpdate={handleCustomPermissionBulkRowUpdate}
                    onDirtyRows={setDirtyCustomPermissionRows}
                  />
                ),
              },
            ]}
          />
        )}
      </AutoFullHeightContainer>
    </div>
  );
};

export default ManagePermissionsEditor;
