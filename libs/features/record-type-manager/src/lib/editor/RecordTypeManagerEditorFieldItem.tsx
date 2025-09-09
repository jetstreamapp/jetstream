import { css } from '@emotion/react';
import { SFDC_BLANK_PICKLIST_VALUE } from '@jetstream/shared/constants';
import { ListItem, PicklistEntry } from '@jetstream/types';
import { Checkbox, ComboboxWithItems } from '@jetstream/ui';
import classNames from 'classnames';
import { useMemo } from 'react';
import { PicklistFieldEntry, RecordTypePicklistConfiguration } from '../types/record-types.types';

const BLANK_LIST_ITEM: ListItem = { id: SFDC_BLANK_PICKLIST_VALUE, label: '--None--', value: SFDC_BLANK_PICKLIST_VALUE };

interface RecordTypeManagerEditorFieldItemProps {
  label: string;
  picklistFieldEntry: PicklistFieldEntry;
  recordTypeName: string;
  picklistValues: Record<string, RecordTypePicklistConfiguration>;
  onSelectAll: (fieldName: string, recordType: string, value: boolean) => void;
  onSelect: (fieldName: string, recordType: string, picklistValue: string, value: boolean) => void;
  onChangeDefaultValue: (fieldName: string, recordType: string, value: string) => void;
}

export function RecordTypeManagerEditorFieldItem({
  label,
  recordTypeName,
  picklistValues,
  picklistFieldEntry,
  onSelectAll,
  onSelect,
  onChangeDefaultValue,
}: RecordTypeManagerEditorFieldItemProps) {
  const { fieldName, values } = picklistFieldEntry;

  const defaultValueIsDirty = picklistValues[fieldName].defaultValue !== picklistValues[fieldName].initialDefaultValue;

  const selectionInvalid = !picklistValues[fieldName].currentValues.size;
  const defaultValueInvalid =
    !selectionInvalid &&
    picklistValues[fieldName].defaultValue !== SFDC_BLANK_PICKLIST_VALUE &&
    !picklistValues[fieldName].currentValues.has(picklistValues[fieldName].defaultValue);

  const listItems = useMemo(
    () => [
      BLANK_LIST_ITEM,
      ...values.map((value) => ({
        id: value.value,
        label: !value.label || value.label === value.value ? value.value : `${value.label} (${value.value})`,
        value: value.value,
      })),
    ],
    [values],
  );

  return (
    <div
      className="slds-m-left_x-small slds-m-bottom_x-small"
      css={css`
        min-width: fit-content;
      `}
    >
      <h3 className="slds-text-title_caps">{label}</h3>
      <Checkbox
        id={`select-all-${recordTypeName}-${fieldName}`}
        className="slds-m-bottom_xx-small"
        label="Select All"
        checked={picklistValues[fieldName].currentValues.size === values.length}
        indeterminate={!!picklistValues[fieldName].currentValues.size && picklistValues[fieldName].currentValues.size < values.length}
        onChange={(value) => onSelectAll(fieldName, recordTypeName, value)}
      />
      {values.map((picklistValue) => (
        <CheckboxItem
          key={picklistValue.value}
          recordTypeName={recordTypeName}
          fieldName={fieldName}
          picklistValue={picklistValue}
          picklistValues={picklistValues}
          onSelect={onSelect}
        />
      ))}
      <ComboboxWithItems
        comboboxProps={{
          label: 'Default Value',
          itemLength: 10,
          usePortal: true,
          className: classNames('slds-m-top_xx-small', {
            'active-item-yellow-bg': defaultValueIsDirty,
          }),
        }}
        items={listItems}
        selectedItemId={picklistValues[fieldName].defaultValue}
        onSelected={(item) => {
          onChangeDefaultValue(fieldName, recordTypeName, item.value);
        }}
      />
      {selectionInvalid && <p className="slds-text-color_error slds-m-top_xx-small">At least one value must be selected.</p>}
      {defaultValueInvalid && <p className="slds-text-color_error slds-m-top_xx-small">The default value must be selected.</p>}
    </div>
  );
}

function CheckboxItem({
  recordTypeName,
  fieldName,
  picklistValue,
  picklistValues,
  onSelect,
}: {
  recordTypeName: string;
  fieldName: string;
  picklistValue: PicklistEntry;
  picklistValues: Record<string, RecordTypePicklistConfiguration>;
  onSelect: (fieldName: string, recordType: string, picklistValue: string, value: boolean) => void;
}) {
  const label =
    !picklistValue.label || picklistValue.label === picklistValue.value
      ? picklistValue.value
      : `${picklistValue.label} (${picklistValue.value})`;
  const isDirty = picklistValues[fieldName].dirtyValues.has(picklistValue.value);
  return (
    <div key={picklistValue.value}>
      <Checkbox
        id={`${recordTypeName}-${fieldName}-${picklistValue.value}`}
        className={classNames({ 'active-item-yellow-bg': isDirty })}
        label={label}
        checked={picklistValues[fieldName].currentValues.has(picklistValue.value)}
        onChange={(value) => onSelect(fieldName, recordTypeName, picklistValue.value, value)}
      />
    </div>
  );
}
