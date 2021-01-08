/** @jsx jsx */
import { ColDef, ColGroupDef } from '@ag-grid-community/core';
import { jsx } from '@emotion/react';
import { logger } from '@jetstream/shared/client-logger';
import { SalesforceOrgUi } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  ConfirmationModalPromise,
  FileDownloadModal,
  Icon,
  Spinner,
  Tabs,
  Toolbar,
  ToolbarItemActions,
  ToolbarItemGroup,
} from '@jetstream/ui';
import { Fragment, FunctionComponent, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRecoilState, useRecoilValue, useResetRecoilState } from 'recoil';
import { selectedOrgState } from '../../app-state';
import * as fromPermissionsStateState from './manage-permissions.state';
import ManagePermissionsEditorTable from './ManagePermissionsEditorTable';
import { usePermissionRecords } from './usePermissionRecords';
import { generateExcelWorkbookFromTable } from './utils/permission-manager-export-utils';
import { ManagePermissionsEditorTableRef, PermissionTableFieldCell } from './utils/permission-manager-table-utils';
import { getUpdatedFieldPermissions, preparePermissionSaveData, savePermissionRecords } from './utils/permission-manager-utils';

const HEIGHT_BUFFER = 170;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ManagePermissionsEditorProps {}

export const ManagePermissionsEditor: FunctionComponent<ManagePermissionsEditorProps> = () => {
  const isMounted = useRef(null);
  const managePermissionsEditorTableRef = useRef<ManagePermissionsEditorTableRef>();
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);

  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [fileDownloadModalOpen, setFileDownloadModalOpen] = useState<boolean>(false);
  const [fileDownloadData, setFileDownloadData] = useState<ArrayBuffer>(null);

  const selectedProfiles = useRecoilValue(fromPermissionsStateState.selectedProfilesPermSetState);
  const selectedPermissionSets = useRecoilValue(fromPermissionsStateState.selectedPermissionSetsState);
  const selectedSObjects = useRecoilValue(fromPermissionsStateState.selectedSObjectsState);

  const [fieldsByObject, setFieldsByObject] = useRecoilState(fromPermissionsStateState.fieldsByObject);
  const [fieldsByKey, setFieldsByKey] = useRecoilState(fromPermissionsStateState.fieldsByKey);
  const [objectPermissionMap, setObjectPermissionMap] = useRecoilState(fromPermissionsStateState.objectPermissionMap);
  const [fieldPermissionMap, setFieldPermissionMap] = useRecoilState(fromPermissionsStateState.fieldPermissionMap);
  const resetFieldsByObject = useResetRecoilState(fromPermissionsStateState.fieldsByObject);
  const resetFieldsByKey = useResetRecoilState(fromPermissionsStateState.fieldsByKey);
  const resetObjectPermissionMap = useResetRecoilState(fromPermissionsStateState.objectPermissionMap);
  const resetFieldPermissionMap = useResetRecoilState(fromPermissionsStateState.fieldPermissionMap);

  // TODO: what about if we already have profiles and perm sets from state?
  // TODO: when loading, should we clear prior selections?
  const recordData = usePermissionRecords(selectedOrg, selectedSObjects, selectedProfiles, selectedPermissionSets);
  const [columns, setColumns] = useState<(ColDef | ColGroupDef)[]>([]);
  const [rows, setRows] = useState<PermissionTableFieldCell[]>([]);

  useEffect(() => {
    isMounted.current = true;
    return () => (isMounted.current = false);
  }, []);

  useEffect(() => {
    setFieldsByObject(recordData.fieldsByObject);
    setFieldsByKey(recordData.fieldsByKey);
    setObjectPermissionMap(recordData.objectPermissionMap);
    setFieldPermissionMap(recordData.fieldPermissionMap);
    // setPermissionsByObjectAndField(recordData.permissionsByObjectAndField);
    // setObjectPermissionsByKey(recordData.objectPermissionsByKey);
    // setFieldPermissionsByKey(recordData.fieldPermissionsByKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    recordData.fieldsByObject,
    recordData.fieldsByKey,
    recordData.objectPermissionMap,
    recordData.fieldPermissionMap,
    // recordData.permissionsByObjectAndField,
    // recordData.objectPermissionsByKey,
    // recordData.fieldPermissionsByKey,
  ]);

  useEffect(() => {
    setLoading(recordData.loading);
  }, [recordData.loading]);

  useEffect(() => {
    if (!loading && fieldsByObject && fieldsByKey && objectPermissionMap && fieldPermissionMap) {
      setHasLoaded(true);
    }
  }, [fieldsByObject, fieldsByKey, objectPermissionMap, fieldPermissionMap]);

  useEffect(() => {
    setHasError(recordData.hasError);
  }, [recordData.hasError]);

  // placeholder for reset
  function handleFoo(profiles: string[]) {
    // if (!sobjects) {
    //   // sobjects cleared, reset other state
    //   resetQueryFieldsMapState();
    //   resetQueryFieldsKey();
    //   resetSelectedSubqueryFieldsState();
    //   resetQueryFiltersState();
    //   resetQueryOrderByState();
    //   resetQueryLimit();
    //   resetQueryLimitSkip();
    //   resetQuerySoqlState();
    //   resetQueryChildRelationships();
    //   resetQueryIncludeDeletedRecordsState();
    // }
  }

  function resetChanges() {
    if (managePermissionsEditorTableRef.current) {
      managePermissionsEditorTableRef.current.resetChanges();
    }
  }

  function exportChanges() {
    if (Array.isArray(rows) && rows.length) {
      setFileDownloadData(generateExcelWorkbookFromTable(columns, rows));
      setFileDownloadModalOpen(true);
    }
  }

  async function saveChanges() {
    if (managePermissionsEditorTableRef.current) {
      const dirtyPermissions = managePermissionsEditorTableRef.current.getDirtyPermissionsForSave();
      logger.log({ dirtyPermissions });
      if (dirtyPermissions.length > 0) {
        /**
         * TODO:
         * 1. create records to insert
         * 2. create records to update (which may cause a deletion)
         *
         * 3. Save records
         * 4. Update locally stored records (add/update/remove)
         *   - may want to create some wrapper data structure so that we have the node id for each item
         *   - since we do not always have records, we don't really know the association of all data
         */

        const preparedData = preparePermissionSaveData(dirtyPermissions);
        logger.log({ preparedData });
        // show confirmation modal
        //TODO:
        if (
          await ConfirmationModalPromise({
            content: 'TODO: make better message, show summary. Are you sure? :D',
          })
        ) {
          setLoading(true);
          const permissionSaveResults = await savePermissionRecords(selectedOrg, preparedData);
          logger.log({ permissionSaveResults });
          if (isMounted.current) {
            // update store data
            // pass data to table for a transaction update (or somehow make it re-load)
            // return permissionSaveResults;
            const tempFieldPermissionMap = getUpdatedFieldPermissions(fieldPermissionMap, permissionSaveResults);
            setFieldPermissionMap(tempFieldPermissionMap);
            setLoading(false);
          }
        }
      }
    }
  }

  function handleGoBack() {
    resetFieldsByObject();
    resetFieldsByKey();
    resetObjectPermissionMap();
    resetFieldPermissionMap();
  }

  return (
    <div>
      {fileDownloadData && fileDownloadModalOpen && (
        <FileDownloadModal
          org={selectedOrg}
          data={fileDownloadData}
          fileNameParts={['permissions', 'export']}
          allowedTypes={['xlsx']}
          onModalClose={() => setFileDownloadModalOpen(false)}
        />
      )}
      <Toolbar>
        <ToolbarItemGroup>
          <Link className="slds-button slds-button_brand" to={{ pathname: `/permissions-manager` }} onClick={handleGoBack}>
            <Icon type="utility" icon="back" className="slds-button__icon slds-button__icon_left" omitContainer />
            Go Back
          </Link>
        </ToolbarItemGroup>
        <ToolbarItemActions>
          <button className="slds-button slds-button_neutral" onClick={resetChanges}>
            <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" />
            Reset Changes
          </button>
          <button className="slds-button slds-button_neutral" onClick={exportChanges}>
            <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" />
            Export
          </button>
          <button className="slds-button slds-button_brand" onClick={saveChanges}>
            <Icon type="utility" icon="upload" className="slds-button__icon slds-button__icon_left" />
            Save
          </button>
        </ToolbarItemActions>
      </Toolbar>
      <AutoFullHeightContainer bottomBuffer={10} className="slds-scrollable_none" bufferIfNotRendered={HEIGHT_BUFFER}>
        {loading && <Spinner />}
        {hasLoaded && (
          // FIXME: we need to move the tabs "above the fold" because the toolbar items apply to sub-content within a tab
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
                    Object Permissions (Coming Soon)
                  </Fragment>
                ),
                titleText: 'Object Permissions',
                disabled: true,
                content: <div />,
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
                    Field Permissions
                  </Fragment>
                ),
                titleText: 'Field Permissions',
                content: (
                  <ManagePermissionsEditorTable
                    ref={managePermissionsEditorTableRef}
                    fieldsByObject={fieldsByObject}
                    onColumns={setColumns}
                    onRows={setRows}
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
