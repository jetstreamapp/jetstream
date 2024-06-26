import { css } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { groupByFlat, multiWordObjectFilter } from '@jetstream/shared/utils';
import {
  DirtyRow,
  FieldPermissionDefinitionMap,
  FieldPermissionRecordForSave,
  ManagePermissionsEditorTableRef,
  ObjectPermissionDefinitionMap,
  ObjectPermissionRecordForSave,
  PermissionFieldSaveData,
  PermissionObjectSaveData,
  PermissionSaveResults,
  PermissionTabVisibilitySaveData,
  PermissionTableFieldCell,
  PermissionTableFieldCellPermission,
  PermissionTableObjectCell,
  PermissionTableObjectCellPermission,
  PermissionTableSummaryRow,
  PermissionTableTabVisibilityCell,
  PermissionTableTabVisibilityCellPermission,
  SalesforceOrgUi,
  TabVisibilityPermissionDefinitionMap,
  TabVisibilityPermissionRecordForSave,
} from '@jetstream/types';
import {
  AutoFullHeightContainer,
  ColumnWithFilter,
  ConfirmationModalPromise,
  FileDownloadModal,
  Icon,
  Spinner,
  Tabs,
  Toast,
  Toolbar,
  ToolbarItemActions,
  ToolbarItemGroup,
  Tooltip,
} from '@jetstream/ui';
import {
  ConfirmPageChange,
  RequireMetadataApiBanner,
  applicationCookieState,
  fromJetstreamEvents,
  fromPermissionsState,
  selectedOrgState,
} from '@jetstream/ui-core';
import { Fragment, FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRecoilState, useRecoilValue, useResetRecoilState } from 'recoil';
import ManagePermissionsEditorFieldTable from './ManagePermissionsEditorFieldTable';
import ManagePermissionsEditorObjectTable from './ManagePermissionsEditorObjectTable';
import ManagePermissionsEditorTabVisibilityTable from './ManagePermissionsEditorTabVisibilityTable';
import { usePermissionRecords } from './usePermissionRecords';
import { generateExcelWorkbookFromTable } from './utils/permission-manager-export-utils';
import {
  getConfirmationModalContent,
  getDirtyFieldPermissions,
  getDirtyObjectPermissions,
  getDirtyTabVisibilityPermissions,
  getFieldColumns,
  getFieldRows,
  getObjectColumns,
  getObjectRows,
  getTabVisibilityColumns,
  getTabVisibilityRows,
  updateFieldRowsAfterSave,
  updateObjectRowsAfterSave,
  updateTabVisibilityRowsAfterSave,
} from './utils/permission-manager-table-utils';
import {
  clearPermissionErrorMessage,
  collectProfileAndPermissionIds,
  getUpdatedFieldPermissions,
  getUpdatedObjectPermissions,
  getUpdatedTabVisibilityPermissions,
  permissionsHaveError,
  prepareFieldPermissionSaveData,
  prepareObjectPermissionSaveData,
  prepareTabVisibilityPermissionSaveData,
  savePermissionRecords,
  updatePermissionSetRecords,
} from './utils/permission-manager-utils';

const HEIGHT_BUFFER = 170;

export function ErrorTooltip({ hasError, id }: { hasError: boolean; id: string }) {
  if (!hasError) {
    return null;
  }
  return (
    <Tooltip
      id={`tooltip-${id}`}
      content={
        <div>
          <strong>There were errors saving your data, review the table for more information.</strong>
        </div>
      }
    >
      <Icon type="utility" icon="error" className="slds-icon slds-icon-text-error slds-icon_xx-small slds-m-left_small" />
    </Tooltip>
  );
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ManagePermissionsEditorProps {}

export const ManagePermissionsEditor: FunctionComponent<ManagePermissionsEditorProps> = () => {
  const isMounted = useRef(true);
  const [{ google_apiKey, google_appId, google_clientId }] = useRecoilState(applicationCookieState);
  const managePermissionsEditorObjectTableRef = useRef<ManagePermissionsEditorTableRef>();
  const managePermissionsEditorFieldTableRef = useRef<ManagePermissionsEditorTableRef>();
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);

  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [fileDownloadModalOpen, setFileDownloadModalOpen] = useState<boolean>(false);
  const [fileDownloadData, setFileDownloadData] = useState<ArrayBuffer | null>(null);

  const selectedProfiles = useRecoilValue(fromPermissionsState.selectedProfilesPermSetState);
  const selectedPermissionSets = useRecoilValue(fromPermissionsState.selectedPermissionSetsState);
  const selectedSObjects = useRecoilValue(fromPermissionsState.selectedSObjectsState);

  const profilesById = useRecoilValue(fromPermissionsState.profilesByIdSelector);
  const permissionSetsById = useRecoilValue(fromPermissionsState.permissionSetsByIdSelector);
  const [fieldsByObject, setFieldsByObject] = useRecoilState(fromPermissionsState.fieldsByObject);
  const [fieldsByKey, setFieldsByKey] = useRecoilState(fromPermissionsState.fieldsByKey);
  const [objectPermissionMap, setObjectPermissionMap] = useRecoilState(fromPermissionsState.objectPermissionMap);
  const [fieldPermissionMap, setFieldPermissionMap] = useRecoilState(fromPermissionsState.fieldPermissionMap);
  const [tabVisibilityPermissionMap, setTabVisibilityPermissionMap] = useRecoilState(fromPermissionsState.tabVisibilityPermissionMap);

  const resetFieldsByObject = useResetRecoilState(fromPermissionsState.fieldsByObject);
  const resetFieldsByKey = useResetRecoilState(fromPermissionsState.fieldsByKey);
  const resetObjectPermissionMap = useResetRecoilState(fromPermissionsState.objectPermissionMap);
  const resetFieldPermissionMap = useResetRecoilState(fromPermissionsState.fieldPermissionMap);
  const resetTabVisibilityPermissionMap = useResetRecoilState(fromPermissionsState.tabVisibilityPermissionMap);

  const recordData = usePermissionRecords(selectedOrg, selectedSObjects, selectedProfiles, selectedPermissionSets);

  const [objectColumns, setObjectColumns] = useState<ColumnWithFilter<PermissionTableObjectCell, PermissionTableSummaryRow>[]>([]);
  const [objectRows, setObjectRows] = useState<PermissionTableObjectCell[] | null>(null);
  const [visibleObjectRows, setVisibleObjectRows] = useState<PermissionTableObjectCell[] | null>(null);
  const [dirtyObjectRows, setDirtyObjectRows] = useState<Record<string, DirtyRow<PermissionTableObjectCell>>>({});
  const [objectFilter, setObjectFilter] = useState('');

  const [tabVisibilityColumns, setTabVisibilityColumns] = useState<
    ColumnWithFilter<PermissionTableTabVisibilityCell, PermissionTableSummaryRow>[]
  >([]);
  const [tabVisibilityRows, setTabVisibilityRows] = useState<PermissionTableTabVisibilityCell[] | null>(null);
  const [visibleTabVisibilityRows, setVisibleTabVisibilityRows] = useState<PermissionTableTabVisibilityCell[] | null>(null);
  const [dirtyTabVisibilityRows, setDirtyTabVisibilityRows] = useState<Record<string, DirtyRow<PermissionTableTabVisibilityCell>>>({});
  const [tabVisibilityFilter, setTabVisibilityFilter] = useState('');

  const [fieldColumns, setFieldColumns] = useState<ColumnWithFilter<PermissionTableFieldCell, PermissionTableSummaryRow>[]>([]);
  const [fieldRows, setFieldRows] = useState<PermissionTableFieldCell[] | null>(null);
  const [visibleFieldRows, setVisibleFieldRows] = useState<PermissionTableFieldCell[] | null>(null);
  const [dirtyFieldRows, setDirtyFieldRows] = useState<Record<string, DirtyRow<PermissionTableFieldCell>>>({});
  const [fieldFilter, setFieldFilter] = useState('');

  const [dirtyObjectCount, setDirtyObjectCount] = useState<number>(0);
  const [dirtyFieldCount, setDirtyFieldCount] = useState<number>(0);
  const [dirtyTabVisibilityCount, setDirtyTabVisibilityCount] = useState<number>(0);

  const [objectsHaveErrors, setObjectsHaveErrors] = useState<boolean>(false);
  const [fieldsHaveErrors, setFieldsHaveErrors] = useState<boolean>(false);
  const [tabVisibilityHaveErrors, setTabVisibilityHaveErrors] = useState<boolean>(false);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordData.fieldsByObject, recordData.fieldsByKey, recordData.objectPermissionMap, recordData.fieldPermissionMap]);

  useEffect(() => {
    setLoading(recordData.loading);
  }, [recordData.loading]);

  useEffect(() => {
    if (!loading && !hasLoaded && fieldsByObject && fieldsByKey && objectPermissionMap && fieldPermissionMap) {
      setHasLoaded(true);
      initTableData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, fieldsByObject, fieldsByKey, objectPermissionMap, fieldPermissionMap]);

  useEffect(() => {
    setHasError(recordData.hasError);
  }, [recordData.hasError]);

  useEffect(() => {
    if (objectPermissionMap && fieldPermissionMap && tabVisibilityPermissionMap) {
      setObjectsHaveErrors(permissionsHaveError(objectPermissionMap));
      setFieldsHaveErrors(permissionsHaveError(fieldPermissionMap));
      setTabVisibilityHaveErrors(permissionsHaveError(tabVisibilityPermissionMap));
    }
  }, [objectPermissionMap, fieldPermissionMap, tabVisibilityPermissionMap]);

  useEffect(() => {
    setDirtyFieldCount(Object.values(dirtyFieldRows).reduce((output, { dirtyCount }) => output + dirtyCount, 0));
  }, [dirtyFieldRows]);

  useEffect(() => {
    setDirtyObjectCount(Object.values(dirtyObjectRows).reduce((output, { dirtyCount }) => output + dirtyCount, 0));
  }, [dirtyObjectRows]);

  useEffect(() => {
    setDirtyTabVisibilityCount(Object.values(dirtyTabVisibilityRows).reduce((output, { dirtyCount }) => output + dirtyCount, 0));
  }, [dirtyTabVisibilityRows]);

  useEffect(() => {
    if (fieldRows && fieldFilter) {
      setVisibleFieldRows(fieldRows.filter(multiWordObjectFilter(['label', 'apiName'], fieldFilter)));
    } else {
      setVisibleFieldRows(fieldRows);
    }
  }, [fieldFilter, fieldRows]);

  useEffect(() => {
    if (objectRows && objectFilter) {
      setVisibleObjectRows(objectRows.filter(multiWordObjectFilter(['label', 'apiName'], objectFilter)));
    } else {
      setVisibleObjectRows(objectRows);
    }
  }, [objectFilter, objectRows]);

  useEffect(() => {
    if (tabVisibilityRows && tabVisibilityFilter) {
      setVisibleTabVisibilityRows(tabVisibilityRows.filter(multiWordObjectFilter(['label', 'apiName'], tabVisibilityFilter)));
    } else {
      setVisibleTabVisibilityRows(tabVisibilityRows);
    }
  }, [tabVisibilityFilter, tabVisibilityRows]);

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
          (output, { createIsDirty, readIsDirty, editIsDirty, deleteIsDirty, viewAllIsDirty, modifyAllIsDirty }) => {
            output += createIsDirty || readIsDirty || editIsDirty || deleteIsDirty || viewAllIsDirty || modifyAllIsDirty ? 1 : 0;
            return output;
          },
          0
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

  function initTableData(
    includeColumns = true,
    objectPermissionMapOverride?: Record<string, ObjectPermissionDefinitionMap>,
    fieldPermissionMapOverride?: Record<string, FieldPermissionDefinitionMap>,
    tabVisibilityPermissionMapOverride?: Record<string, TabVisibilityPermissionDefinitionMap>
  ) {
    if (includeColumns) {
      setObjectColumns(getObjectColumns(selectedProfiles, selectedPermissionSets, profilesById, permissionSetsById));
      setFieldColumns(getFieldColumns(selectedProfiles, selectedPermissionSets, profilesById, permissionSetsById));
      setTabVisibilityColumns(getTabVisibilityColumns(selectedProfiles, selectedPermissionSets, profilesById, permissionSetsById));
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
      tabVisibilityPermissionMapOverride || tabVisibilityPermissionMap || {}
    );
    setTabVisibilityRows(tempTabVisibilityRows);
    setVisibleTabVisibilityRows(tempTabVisibilityRows);
    setDirtyTabVisibilityRows({});
  }

  function exportChanges() {
    // generate brand-new columns/rows just for export
    // This is required in the case where a tab may not have been rendered
    setFileDownloadData(
      generateExcelWorkbookFromTable(
        {
          columns: getObjectColumns(selectedProfiles, selectedPermissionSets, profilesById, permissionSetsById),
          rows: getObjectRows(selectedSObjects, objectPermissionMap || {}),
        },
        {
          columns: getTabVisibilityColumns(selectedProfiles, selectedPermissionSets, profilesById, permissionSetsById),
          rows: getTabVisibilityRows(selectedSObjects, tabVisibilityPermissionMap || {}),
        },
        {
          columns: getFieldColumns(selectedProfiles, selectedPermissionSets, profilesById, permissionSetsById),
          rows: getFieldRows(selectedSObjects, fieldsByObject || {}, fieldPermissionMap || {}),
        }
      )
    );
    setFileDownloadModalOpen(true);
  }

  async function saveChanges() {
    if (
      await ConfirmationModalPromise({
        header: 'Confirmation',
        confirm: 'Save Changes',
        content: getConfirmationModalContent(dirtyObjectCount, dirtyFieldCount, dirtyTabVisibilityCount),
      })
    ) {
      setLoading(true);
      let objectPermissionData: PermissionObjectSaveData | undefined = undefined;
      let fieldPermissionData: PermissionFieldSaveData | undefined = undefined;
      let tabVisibilityPermissionData: PermissionTabVisibilitySaveData | undefined = undefined;
      let profileIds: string[] = [];
      let permissionSetIds: string[] = [];

      if (dirtyObjectCount) {
        const dirtyPermissions = getDirtyObjectPermissions(dirtyObjectRows);
        if (dirtyPermissions.length > 0) {
          objectPermissionData = prepareObjectPermissionSaveData(dirtyPermissions);
          const ids = collectProfileAndPermissionIds(dirtyPermissions, profilesById, permissionSetsById);
          profileIds = [...profileIds, ...ids.profileIds];
          permissionSetIds = [...permissionSetIds, ...ids.permissionSetIds];
        }
      }
      if (dirtyFieldCount) {
        const dirtyPermissions = getDirtyFieldPermissions(dirtyFieldRows);
        if (dirtyPermissions.length > 0) {
          fieldPermissionData = prepareFieldPermissionSaveData(dirtyPermissions);
          const ids = collectProfileAndPermissionIds(dirtyPermissions, profilesById, permissionSetsById);
          profileIds = [...profileIds, ...ids.profileIds];
          permissionSetIds = [...permissionSetIds, ...ids.permissionSetIds];
        }
      }
      if (dirtyTabVisibilityCount) {
        const dirtyPermissions = getDirtyTabVisibilityPermissions(dirtyTabVisibilityRows);
        if (dirtyPermissions.length > 0) {
          tabVisibilityPermissionData = prepareTabVisibilityPermissionSaveData(dirtyPermissions);
          const ids = collectProfileAndPermissionIds(dirtyPermissions, profilesById, permissionSetsById);
          profileIds = [...profileIds, ...ids.profileIds];
          permissionSetIds = [...permissionSetIds, ...ids.permissionSetIds];
        }
      }

      let objectSaveResults: PermissionSaveResults<ObjectPermissionRecordForSave, PermissionTableObjectCellPermission>[] | undefined =
        undefined;
      let fieldSaveResults: PermissionSaveResults<FieldPermissionRecordForSave, PermissionTableFieldCellPermission>[] | undefined =
        undefined;
      let tabVisibilitySaveResults:
        | PermissionSaveResults<TabVisibilityPermissionRecordForSave, PermissionTableTabVisibilityCellPermission>[]
        | undefined = undefined;

      if (objectPermissionData) {
        objectSaveResults = await savePermissionRecords<ObjectPermissionRecordForSave, PermissionTableObjectCellPermission>(
          selectedOrg,
          'ObjectPermissions',
          objectPermissionData
        );
        logger.log({ objectSaveResults });
      }
      if (fieldPermissionData) {
        fieldSaveResults = await savePermissionRecords<FieldPermissionRecordForSave, PermissionTableFieldCellPermission>(
          selectedOrg,
          'FieldPermissions',
          fieldPermissionData
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

      // Update records so that SFDX is aware of the changes
      try {
        await updatePermissionSetRecords(selectedOrg, {
          permissionSetIds: Array.from(permissionSetIds),
          profileIds: Array.from(profileIds),
        });
      } catch (ex) {
        logger.error('Error flagging permissions sets as updated', ex);
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
        setLoading(false);
      }
    }
  }

  function resetChanges() {
    const updatedObjectPermissionMap = clearPermissionErrorMessage(objectPermissionMap || {});
    const updatedFieldPermissionMap = clearPermissionErrorMessage(fieldPermissionMap || {});
    const updatedTabVisibilityPermissionMap = clearPermissionErrorMessage(tabVisibilityPermissionMap || {});
    setObjectPermissionMap(updatedObjectPermissionMap);
    setFieldPermissionMap(updatedFieldPermissionMap);
    setTabVisibilityPermissionMap(updatedTabVisibilityPermissionMap);
    initTableData(false, updatedObjectPermissionMap, updatedFieldPermissionMap, updatedTabVisibilityPermissionMap);
  }

  function handleGoBack() {
    resetFieldsByObject();
    resetFieldsByKey();
    resetObjectPermissionMap();
    resetFieldPermissionMap();
    resetTabVisibilityPermissionMap();
  }

  return (
    <div>
      <ConfirmPageChange actionInProgress={loading} />
      {fileDownloadData && fileDownloadModalOpen && (
        <FileDownloadModal
          org={selectedOrg}
          google_apiKey={google_apiKey}
          google_appId={google_appId}
          google_clientId={google_clientId}
          data={fileDownloadData}
          fileNameParts={['permissions', 'export']}
          allowedTypes={['xlsx']}
          onModalClose={() => setFileDownloadModalOpen(false)}
          emitUploadToGoogleEvent={fromJetstreamEvents.emit}
        />
      )}
      <RequireMetadataApiBanner />
      <Toolbar>
        <ToolbarItemGroup>
          <Link className="slds-button slds-button_brand" to=".." onClick={handleGoBack}>
            <Icon type="utility" icon="back" className="slds-button__icon slds-button__icon_left" omitContainer />
            Go Back
          </Link>
        </ToolbarItemGroup>
        <ToolbarItemActions>
          <button
            className="slds-button slds-button_neutral collapsible-button collapsible-button-xs"
            onClick={resetChanges}
            title="Reset Changes"
            disabled={
              loading ||
              (!dirtyObjectCount &&
                !dirtyFieldCount &&
                !dirtyTabVisibilityCount &&
                !objectsHaveErrors &&
                !fieldsHaveErrors &&
                !tabVisibilityHaveErrors)
            }
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
          <button
            className="slds-button slds-button_brand"
            onClick={saveChanges}
            disabled={loading || (!dirtyObjectCount && !dirtyFieldCount && !dirtyTabVisibilityCount)}
          >
            <Icon type="utility" icon="upload" className="slds-button__icon slds-button__icon_left" />
            Save
          </button>
        </ToolbarItemActions>
      </Toolbar>
      <AutoFullHeightContainer
        baseCss={css`
          background-color: #ffffff;
        `}
        bottomBuffer={10}
        className="slds-scrollable_none"
        bufferIfNotRendered={HEIGHT_BUFFER}
      >
        {loading && <Spinner />}
        {hasError && <Toast type="error">Uh Oh. There was a problem getting the permission data from Salesforce.</Toast>}
        {hasLoaded && (
          <Tabs
            initialActiveId="field-permissions"
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
                content: (
                  <ManagePermissionsEditorObjectTable
                    ref={managePermissionsEditorObjectTableRef}
                    columns={objectColumns}
                    rows={visibleObjectRows || []}
                    totalCount={objectRows?.length || 0}
                    onFilter={setObjectFilter}
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
                content: (
                  <ManagePermissionsEditorTabVisibilityTable
                    ref={managePermissionsEditorObjectTableRef}
                    columns={tabVisibilityColumns}
                    rows={visibleTabVisibilityRows || []}
                    totalCount={objectRows?.length || 0}
                    onFilter={setTabVisibilityFilter}
                    onBulkUpdate={handleTabVisibilityBulkRowUpdate}
                    onDirtyRows={setDirtyTabVisibilityRows}
                  />
                ),
              },

              {
                id: 'field-permissions',
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
                content: (
                  <ManagePermissionsEditorFieldTable
                    ref={managePermissionsEditorFieldTableRef}
                    columns={fieldColumns}
                    rows={visibleFieldRows || []}
                    totalCount={fieldRows?.length || 0}
                    onFilter={setFieldFilter}
                    onBulkUpdate={handleFieldBulkRowUpdate}
                    onDirtyRows={setDirtyFieldRows}
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
