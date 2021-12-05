import { formatNumber } from '@jetstream/shared/ui-utils';
import { pluralizeIfMultiple } from '@jetstream/shared/utils';
import { SalesforceOrgUi } from '@jetstream/types';
import { AutoFullHeightContainer, Badge, Grid, Icon, Toolbar, ToolbarItemActions, ToolbarItemGroup, Tooltip } from '@jetstream/ui';
import React, { FunctionComponent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRecoilValue } from 'recoil';
import { selectedOrgState } from '../../app-state';
import * as fromCreateFieldsState from './create-fields.state';
import CreateFieldsDeployModal from './CreateFieldsDeployModal';
import CreateFieldsImportExport from './CreateFieldsImportExport';
import CreateFieldsRow from './CreateFieldsRow';
import { useFieldValues } from './useFieldValues';

function SelectedItemsBadge(items: string[], label: string) {
  return (
    <Badge className="slds-m-right_xx-small">
      {formatNumber(items.length)} {pluralizeIfMultiple(label, items)} selected
    </Badge>
  );
}

export interface CreateFieldsProps {
  apiVersion: string;
}

export const CreateFields: FunctionComponent<CreateFieldsProps> = ({ apiVersion }) => {
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);

  const selectedProfiles = useRecoilValue(fromCreateFieldsState.selectedProfilesPermSetState);
  const selectedPermissionSets = useRecoilValue(fromCreateFieldsState.selectedPermissionSetsState);
  const selectedSObjects = useRecoilValue(fromCreateFieldsState.selectedSObjectsState);

  const { rows, allValid, addRow, importRows, cloneRow, removeRow, changeRow, touchRow, resetRows, picklistOptionChanged } =
    useFieldValues();

  const [deployModalOpen, setDeployModalOpen] = useState(false);

  function handleSubmit() {
    setDeployModalOpen(true);
  }

  function handleCloseModal() {
    setDeployModalOpen(false);
  }

  return (
    <div>
      {deployModalOpen && (
        <CreateFieldsDeployModal
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
          <Link className="slds-button slds-button_brand slds-m-right_x-small" to={{ pathname: `/deploy-sobject-metadata` }}>
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
      <div>
        <Grid className="slds-box_small slds-theme_default slds-is-relative" verticalAlign="center" wrap>
          {SelectedItemsBadge(selectedSObjects, 'Object')}
          {SelectedItemsBadge(selectedProfiles, 'Profile')}
          {SelectedItemsBadge(selectedPermissionSets, 'Permission Set')}
        </Grid>
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
    </div>
  );
};

export default CreateFields;
