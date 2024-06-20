import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { groupByFlat, pluralizeIfMultiple } from '@jetstream/shared/utils';
import { ListItem, SalesforceOrgUi } from '@jetstream/types';
import {
  AutoFullHeightContainer,
  BadgePopover,
  BadgePopoverList,
  ConfirmationModalPromise,
  Grid,
  Icon,
  Toolbar,
  ToolbarItemActions,
  ToolbarItemGroup,
  Tooltip,
} from '@jetstream/ui';
import { RequireMetadataApiBanner, selectedOrgState, useAmplitude } from '@jetstream/ui-core';
import { FunctionComponent, useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRecoilValue, useResetRecoilState } from 'recoil';
import CreateFieldsDeployModal from './CreateFieldsDeployModal';
import CreateFieldsImportExport from './CreateFieldsImportExport';
import CreateFieldsRow from './CreateFieldsRow';
import * as fromCreateFieldsState from './create-fields.state';
import { useFieldValues } from './useFieldValues';

function SelectedItemsBadge({
  items: _items,
  labelListItem,
  label,
}: {
  items: string[];
  labelListItem?: ListItem[] | null;
  label: string;
}) {
  const [items] = useState<ListItem[]>(() => {
    if (labelListItem?.length) {
      const itemsById = groupByFlat(labelListItem, 'id');
      return _items.map(
        (item): ListItem => ({
          id: item,
          label: itemsById[item]?.label || item,
          value: item,
        })
      );
    } else {
      return _items.map(
        (item): ListItem => ({
          id: item,
          label: item,
          value: item,
        })
      );
    }
  });
  if (!_items.length) {
    return null;
  }
  return (
    <BadgePopover
      badgeLabel={`${formatNumber(items.length)} ${pluralizeIfMultiple(label, items)} selected`}
      popoverTitle={`Selected ${label}s`}
    >
      <BadgePopoverList items={items} liClassName="slds-item read-only" />
    </BadgePopover>
  );
}

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface CreateFieldsProps {}

export const CreateFields: FunctionComponent<CreateFieldsProps> = () => {
  const { trackEvent } = useAmplitude();
  const selectedOrg = useRecoilValue<SalesforceOrgUi>(selectedOrgState);

  const profiles = useRecoilValue(fromCreateFieldsState.profilesState);
  const permissionSets = useRecoilValue(fromCreateFieldsState.permissionSetsState);

  const selectedProfiles = useRecoilValue(fromCreateFieldsState.selectedProfilesPermSetState);
  const selectedPermissionSets = useRecoilValue(fromCreateFieldsState.selectedPermissionSetsState);
  const selectedSObjects = useRecoilValue(fromCreateFieldsState.selectedSObjectsState);

  const profilesAndPermSetsById = useRecoilValue(fromCreateFieldsState.profilesAndPermSetsByIdSelector);

  const resetProfilesState = useResetRecoilState(fromCreateFieldsState.profilesState);
  const resetSelectedProfilesPermSetState = useResetRecoilState(fromCreateFieldsState.selectedProfilesPermSetState);
  const resetPermissionSetsState = useResetRecoilState(fromCreateFieldsState.permissionSetsState);
  const resetSelectedPermissionSetsState = useResetRecoilState(fromCreateFieldsState.selectedPermissionSetsState);
  const resetSObjectsState = useResetRecoilState(fromCreateFieldsState.sObjectsState);
  const resetSelectedSObjectsState = useResetRecoilState(fromCreateFieldsState.selectedSObjectsState);
  const resetFieldRowsState = useResetRecoilState(fromCreateFieldsState.fieldRowsState);

  const { rows, allValid, addRow, importRows, cloneRow, removeRow, changeRow, touchRow, resetRows, picklistOptionChanged } =
    useFieldValues();

  const [deployModalOpen, setDeployModalOpen] = useState(false);

  function handleReset() {
    resetRows();
    trackEvent(ANALYTICS_KEYS.sobj_create_field_reset_rows, { numFields: rows.length });
  }

  const handleStartOver = useCallback(async () => {
    if (
      await ConfirmationModalPromise({
        content: 'Are you sure you want to start over?',
      })
    ) {
      resetProfilesState();
      resetSelectedProfilesPermSetState();
      resetPermissionSetsState();
      resetSelectedPermissionSetsState();
      resetSObjectsState();
      resetSelectedSObjectsState();
      resetFieldRowsState();
    }
  }, []);

  function handleSubmit() {
    setDeployModalOpen(true);
    trackEvent(ANALYTICS_KEYS.sobj_create_field_submit_modal_opened, {
      numFields: rows.length,
      selectedProfiles: selectedProfiles.length,
      selectedPermissionSets: selectedPermissionSets.length,
      selectedSObjects: selectedSObjects.length,
    });
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
          profilesAndPermSetsById={profilesAndPermSetsById}
          sObjects={selectedSObjects}
          rows={rows}
          onClose={handleCloseModal}
        />
      )}
      <RequireMetadataApiBanner />
      <Toolbar>
        <ToolbarItemGroup>
          <Link
            className="slds-button slds-button_brand slds-m-right_x-small"
            to=".."
            title="Going back will keep all of your fields configured as-is, but you can change your selected objects, profiles, and permission sets."
          >
            <Icon type="utility" icon="back" className="slds-button__icon slds-button__icon_left" omitContainer />
            Go Back
          </Link>
          <button
            className="slds-button slds-button_neutral slds-m-right_x-small collapsible-button collapsible-button-lg"
            onClick={() => handleStartOver()}
            title="Start Over"
          >
            <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" omitContainer />
            <span>Start Over</span>
          </button>
          <CreateFieldsImportExport selectedOrg={selectedOrg} rows={rows} onImportRows={importRows} />
        </ToolbarItemGroup>
        <ToolbarItemActions>
          <button
            className="slds-button slds-button_neutral slds-m-right_x-small collapsible-button collapsible-button-sm"
            onClick={() => handleReset()}
            title="Reset fields"
          >
            <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" omitContainer />
            <span>Reset Fields</span>
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
          <SelectedItemsBadge items={selectedSObjects} label="Object" />
          <SelectedItemsBadge labelListItem={profiles} items={selectedProfiles} label="Profile" />
          <SelectedItemsBadge labelListItem={permissionSets} items={selectedPermissionSets} label="Permission Set" />
          <div className="slds-col_bump-left">
            <button className="slds-button slds-button_neutral" onClick={() => addRow()}>
              <Icon type="utility" icon="add" className="slds-button__icon slds-button__icon_left" omitContainer />
              New Field
            </button>
          </div>
        </Grid>
        <AutoFullHeightContainer className="slds-box_small slds-theme_default slds-is-relative">
          {rows.map((row, i) => (
            <CreateFieldsRow
              key={row._key}
              rows={rows}
              rowIdx={i}
              enableDelete={rows.length > 1}
              selectedOrg={selectedOrg}
              selectedSObjects={selectedSObjects}
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
