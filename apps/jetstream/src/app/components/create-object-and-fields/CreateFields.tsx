import { SalesforceOrgUi } from '@jetstream/types';
import React, { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { Link, Redirect, Route, Switch, useRouteMatch } from 'react-router-dom';
import { useRecoilState, useRecoilValue, useResetRecoilState } from 'recoil';
import { selectedOrgState } from '../../app-state';
import StateDebugObserver from '../core/StateDebugObserver';
// import * as fromDeployMetadataState from './deploy-metadata.state';
// import DeployMetadataDeployment from './DeployMetadataDeployment';
// import DeployMetadataSelection from './DeployMetadataSelection';
import { TITLES } from '@jetstream/shared/constants';
import { useTitle } from 'react-use';
import { getInitialValues } from './create-fields-utils';
import CreateFieldsRow from './CreateFieldsRow';
import { FieldDefinitionType, FieldValue, FieldValues } from './create-fields-types';
import {
  AutoFullHeightContainer,
  ConfirmationModalPromise,
  Grid,
  Icon,
  Toolbar,
  ToolbarItemActions,
  ToolbarItemGroup,
  Tooltip,
} from '@jetstream/ui';
import { useFieldValues } from './useFieldValues';
import * as fromCreateFieldsState from './create-fields.state';
import CreateFieldsDeployModal from './CreateFieldsDeployModal';
import CreateFieldsImportExport from './CreateFieldsImportExport';
import { useRollbar } from '@jetstream/shared/ui-utils';

export interface CreateFieldsProps {
  apiVersion: string;
}

export const CreateFields: FunctionComponent<CreateFieldsProps> = ({ apiVersion }) => {
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  // TODO: allow adjusting in sidebar?
  const [selectedProfiles, setSelectedProfiles] = useRecoilState(fromCreateFieldsState.selectedProfilesPermSetState);
  const [selectedPermissionSets, setSelectedPermissionSets] = useRecoilState(fromCreateFieldsState.selectedPermissionSetsState);
  const [selectedSObjects, setSelectedSObjects] = useRecoilState(fromCreateFieldsState.selectedSObjectsState);

  const { rows, allValid, addRow, importRows, cloneRow, removeRow, changeRow, touchRow, resetRows, picklistOptionChanged } =
    useFieldValues();

  const [deployModalOpen, setDeployModalOpen] = useState(false);

  function handleSubmit() {
    setDeployModalOpen(true);
  }

  function handleCloseModal() {
    setDeployModalOpen(false);
  }

  function handleExport() {
    // TODO:
  }

  function handleImport() {
    // TODO:
  }

  return (
    <div>
      {deployModalOpen && (
        <CreateFieldsDeployModal
          apiVersion={apiVersion}
          selectedOrg={selectedOrg}
          profiles={selectedProfiles}
          permissionSets={selectedPermissionSets}
          sObjects={selectedSObjects}
          rows={rows}
          onClose={handleCloseModal}
        />
      )}
      <Toolbar>
        <ToolbarItemGroup>
          <Link className="slds-button slds-button_brand slds-m-right_x-small" to={{ pathname: `/create-objects-and-fields` }}>
            <Icon type="utility" icon="back" className="slds-button__icon slds-button__icon_left" omitContainer />
            Go Back
          </Link>
          <CreateFieldsImportExport selectedOrg={selectedOrg} rows={rows} onImportRows={importRows} />
        </ToolbarItemGroup>
        <ToolbarItemActions>
          <button className="slds-button slds-button_neutral slds-m-right_x-small" onClick={() => resetRows()}>
            <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" omitContainer />
            Reset Changes
          </button>
          <Tooltip content={allValid ? '' : 'All fields must be fully configured'}>
            <button className="slds-button slds-button_brand" onClick={() => handleSubmit()} disabled={!allValid}>
              <Icon type="utility" icon="upload" className="slds-button__icon slds-button__icon_left" omitContainer />
              Create Fields
            </button>
          </Tooltip>
        </ToolbarItemActions>
      </Toolbar>
      <AutoFullHeightContainer className="slds-box_small slds-theme_default slds-is-relative">
        {rows.map((row, i) => (
          <CreateFieldsRow
            key={row._key}
            rowIdx={i}
            enableDelete={rows.length > 1}
            selectedOrg={selectedOrg}
            values={row}
            allValid={row._allValid}
            onChange={(field, value) => changeRow(row._key, field, value)}
            onClone={() => cloneRow(row._key)}
            onDelete={() => removeRow(row._key)}
            onBlur={(field) => touchRow(row._key, field)}
            onChangePicklistOption={(value) => picklistOptionChanged(row._key, value)}
          />
        ))}
        <div className="slds-box_small">
          <button className="slds-button slds-button_neutral" onClick={() => addRow()}>
            <Icon type="utility" icon="add" className="slds-button__icon slds-button__icon_left" omitContainer />
            New Field
          </button>
        </div>
      </AutoFullHeightContainer>
    </div>
  );
};

export default CreateFields;
