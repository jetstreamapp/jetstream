import { SalesforceOrgUi } from '@jetstream/types';
import React, { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { Link, Redirect, Route, Switch, useRouteMatch } from 'react-router-dom';
import { useRecoilValue, useResetRecoilState } from 'recoil';
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
import { AutoFullHeightContainer, Grid, Icon, Toolbar, ToolbarItemActions, ToolbarItemGroup } from '@jetstream/ui';
import { useFieldValues } from './useFieldValues';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface CreateFieldsProps {}

export const CreateFields: FunctionComponent<CreateFieldsProps> = () => {
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);
  const { rows, allValid, addRow, cloneRow, removeRow, changeRow, touchRow, picklistOptionChanged } = useFieldValues();

  function handleSubmit() {
    // TODO:
  }

  return (
    <div>
      <Toolbar>
        <ToolbarItemGroup>
          <Link className="slds-button slds-button_brand" to={{ pathname: `/create-objects-and-fields` }}>
            <Icon type="utility" icon="back" className="slds-button__icon slds-button__icon_left" omitContainer />
            Go Back
          </Link>
        </ToolbarItemGroup>
        <ToolbarItemActions>
          <button className="slds-button slds-button_brand" onClick={() => handleSubmit()} disabled={false}>
            <Icon type="utility" icon="upload" className="slds-button__icon slds-button__icon_left" omitContainer />
            Create Fields
          </button>
        </ToolbarItemActions>
      </Toolbar>
      <AutoFullHeightContainer className="slds-box_small slds-theme_default slds-is-relative">
        {rows.map((row) => (
          <CreateFieldsRow
            key={row._key}
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
