import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { formatNumber, useGoBackShortcut, usePrimaryActionShortcut } from '@jetstream/shared/ui-utils';
import { groupByFlat, pluralizeIfMultiple } from '@jetstream/shared/utils';
import { ListItem } from '@jetstream/types';
import {
  AssistiveStatus,
  AutoFullHeightContainer,
  BadgePopover,
  BadgePopoverList,
  ConfirmationModalPromise,
  Grid,
  Icon,
  KeyboardShortcut,
  Toolbar,
  ToolbarItemActions,
  ToolbarItemGroup,
  Tooltip,
  getAriaKeyshortcuts,
  getModifierKey,
} from '@jetstream/ui';
import { RequireMetadataApiBanner, useAmplitude } from '@jetstream/ui-core';
import { selectedOrgState } from '@jetstream/ui/app-state';
import { useAtomValue } from 'jotai';
import { useResetAtom } from 'jotai/utils';
import { FunctionComponent, useCallback, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import CreateFieldsDeployModal from './CreateFieldsDeployModal';
import CreateFieldsImportExport from './CreateFieldsImportExport';
import CreateFieldsRow from './CreateFieldsRow';
import { LoadExistingFieldsModal } from './LoadExistingFieldsModal';
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
      return _items.map((item): ListItem => ({
        id: item,
        label: itemsById[item]?.label || item,
        value: item,
      }));
    } else {
      return _items.map((item): ListItem => ({
        id: item,
        label: item,
        value: item,
      }));
    }
  });
  if (!_items.length) {
    return null;
  }
  return (
    <BadgePopover
      badgeLabel={`${formatNumber(items.length)} ${pluralizeIfMultiple(label, items)} selected`}
      badgeProps={{ type: 'light' }}
      popoverTitle={`Selected ${label}s`}
    >
      <BadgePopoverList items={items} liClassName="slds-item read-only" />
    </BadgePopover>
  );
}

export interface CreateFieldsProps {}

export const CreateFields: FunctionComponent<CreateFieldsProps> = () => {
  const navigate = useNavigate();
  const { trackEvent } = useAmplitude();
  const selectedOrg = useAtomValue(selectedOrgState);

  const profiles = useAtomValue(fromCreateFieldsState.profilesState);
  const permissionSets = useAtomValue(fromCreateFieldsState.permissionSetsState);

  const selectedProfiles = useAtomValue(fromCreateFieldsState.selectedProfilesPermSetState);
  const selectedPermissionSets = useAtomValue(fromCreateFieldsState.selectedPermissionSetsState);
  const selectedSObjects = useAtomValue(fromCreateFieldsState.selectedSObjectsState);

  const profilesAndPermSetsById = useAtomValue(fromCreateFieldsState.profilesAndPermSetsByIdSelector);

  const resetProfilesState = useResetAtom(fromCreateFieldsState.profilesState);
  const resetSelectedProfilesPermSetState = useResetAtom(fromCreateFieldsState.selectedProfilesPermSetState);
  const resetPermissionSetsState = useResetAtom(fromCreateFieldsState.permissionSetsState);
  const resetSelectedPermissionSetsState = useResetAtom(fromCreateFieldsState.selectedPermissionSetsState);
  const resetSObjectsState = useResetAtom(fromCreateFieldsState.sObjectsState);
  const resetSelectedSObjectsState = useResetAtom(fromCreateFieldsState.selectedSObjectsState);
  const resetFieldRowsState = useResetAtom(fromCreateFieldsState.fieldRowsState);

  const {
    rows,
    allValid,
    addRow,
    importRows,
    cloneRow,
    removeRow,
    changeRow,
    touchRow,
    regenerateFullName,
    resetRows,
    picklistOptionChanged,
  } = useFieldValues();

  const [deployModalOpen, setDeployModalOpen] = useState(false);
  const [loadFieldsModalOpen, setLoadFieldsModalOpen] = useState(false);

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
  }, [
    resetFieldRowsState,
    resetPermissionSetsState,
    resetProfilesState,
    resetSObjectsState,
    resetSelectedPermissionSetsState,
    resetSelectedProfilesPermSetState,
    resetSelectedSObjectsState,
  ]);

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

  usePrimaryActionShortcut(handleSubmit, { disabled: !allValid });
  useGoBackShortcut(() => navigate('..'), {});

  const [rowStatusMessage, setRowStatusMessage] = useState('');

  /** Clear-then-set so repeated adds/deletes each announce */
  function announceRowChange(message: string) {
    setRowStatusMessage('');
    window.setTimeout(() => setRowStatusMessage(message), 100);
  }

  // Focus deliberately STAYS on the New Field button (users often add several fields, then fill
  // them in) — the announcement is what tells screen reader users the row was appended above
  function handleAddRow() {
    addRow();
    announceRowChange(`Field ${rows.length + 1} added`);
  }

  /** Clone appends a copy at the end of the list, out of view of the Clone button that was pressed */
  function handleCloneRow(key: number) {
    const sourceLabel = rows.find((row) => row._key === key)?.label.value;
    cloneRow(key);
    announce(`Field ${rows.length + 1} added as a copy of ${sourceLabel || 'the field'}`);
  }

  /** The Delete button unmounts with its card — focus the card that slides into the slot (or the last) */
  function handleRemoveRow(key: number, index: number) {
    const countBefore = rows.length;
    removeRow(key);
    announceRowChange('Field deleted');
    window.setTimeout(() => {
      const targetIndex = Math.min(index, countBefore - 2);
      document
        .querySelector(`[data-field-row-index="${targetIndex}"]`)
        ?.querySelector<HTMLElement>('input, button, textarea, select')
        ?.focus();
    }, 50);
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
      {loadFieldsModalOpen && (
        <LoadExistingFieldsModal
          selectedOrg={selectedOrg}
          selectedSObjects={selectedSObjects}
          onLoadFields={importRows}
          onClose={() => setLoadFieldsModalOpen(false)}
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
            <Link
              className="slds-button slds-button_brand slds-m-right_x-small"
              aria-keyshortcuts={getAriaKeyshortcuts([getModifierKey(), 'shift', 'enter'])}
              to=".."
              title="Going back will keep all of your fields configured as-is, but you can change your selected objects, profiles, and permission sets."
            >
              <Icon type="utility" icon="back" className="slds-button__icon slds-button__icon_left" omitContainer />
              Go Back
            </Link>
          </Tooltip>
          <button
            className="slds-button slds-button_neutral slds-m-right_x-small collapsible-button collapsible-button-lg"
            onClick={() => handleStartOver()}
            title="Start Over"
          >
            <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_left" omitContainer />
            <span>Start Over</span>
          </button>
          <CreateFieldsImportExport
            selectedOrg={selectedOrg}
            rows={rows}
            onImportRows={importRows}
            onLoadFromOrg={() => setLoadFieldsModalOpen(true)}
          />
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
          <Tooltip
            openDelay={500}
            content={
              allValid ? (
                <div className="slds-p-bottom_small">
                  <KeyboardShortcut inverse keys={[getModifierKey(), 'enter']} />
                </div>
              ) : (
                'All fields must be fully configured'
              )
            }
          >
            <button
              className="slds-button slds-button_brand"
              aria-keyshortcuts={getAriaKeyshortcuts([getModifierKey(), 'enter'])}
              onClick={() => handleSubmit()}
              disabled={!allValid}
            >
              <Icon type="utility" icon="upload" className="slds-button__icon slds-button__icon_left" omitContainer />
              Upsert Fields
            </button>
          </Tooltip>
        </ToolbarItemActions>
      </Toolbar>
      <AssistiveStatus message={rowStatusMessage} />
      <div>
        <Grid className="slds-box_small slds-theme_default slds-is-relative" verticalAlign="center" wrap>
          <SelectedItemsBadge items={selectedSObjects} label="Object" />
          <SelectedItemsBadge labelListItem={profiles} items={selectedProfiles} label="Profile" />
          <SelectedItemsBadge labelListItem={permissionSets} items={selectedPermissionSets} label="Permission Set" />
          <div className="slds-col_bump-left">
            <button className="slds-button slds-button_neutral" onClick={() => handleAddRow()}>
              <Icon type="utility" icon="add" className="slds-button__icon slds-button__icon_left" omitContainer />
              New Field
            </button>
          </div>
        </Grid>
        <AutoFullHeightContainer className="slds-box_small slds-theme_default slds-is-relative">
          {/* Real list semantics: screen readers announce "list, N items" and each card announces
              its field name + configuration status (see CreateFieldsRow) */}
          <div role="list" aria-label="Fields to create">
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
                onClone={() => handleCloneRow(row._key)}
                onDelete={() => handleRemoveRow(row._key, i)}
                onBlur={(field) => touchRow(row._key, field)}
                onRegenerateFullName={() => regenerateFullName(row._key)}
                onChangePicklistOption={(value) => picklistOptionChanged(row._key, value)}
              />
            ))}
          </div>
          <div className="slds-box_small">
            <button className="slds-button slds-button_neutral" onClick={() => handleAddRow()}>
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
