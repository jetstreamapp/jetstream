import { FieldWithRelatedEntities, InsertUpdateUpsertDelete, ListItem, Maybe } from '@jetstream/types';
import { ComboboxWithItems, Grid, GridCol, RadioButton, RadioGroup, ScopedNotification, Spinner } from '@jetstream/ui';
import { FunctionComponent, useEffect, useState } from 'react';
import { LOAD_NOT_ALLOWED_MESSAGE, useAllowedLoadTypes } from '../useAllowedLoadTypes';

const LOAD_TYPE_OPTIONS: { value: InsertUpdateUpsertDelete; label: string }[] = [
  { value: 'INSERT', label: 'Insert' },
  { value: 'UPDATE', label: 'Update' },
  { value: 'UPSERT', label: 'Upsert' },
  { value: 'DELETE', label: 'Delete' },
  { value: 'HARD_DELETE', label: 'Hard Delete' },
];

export interface LoadRecordsLoadTypeButtonsProps {
  selectedType: InsertUpdateUpsertDelete;
  loadingFields: Maybe<boolean>;
  externalIdFields: FieldWithRelatedEntities[];
  externalId: string;
  isCustomMetadataObject: boolean;
  onChange: (type: InsertUpdateUpsertDelete, externalId: Maybe<string>) => void;
}

export const LoadRecordsLoadTypeButtons: FunctionComponent<LoadRecordsLoadTypeButtonsProps> = ({
  selectedType = 'INSERT',
  loadingFields,
  externalIdFields,
  externalId: externalIdInit,
  isCustomMetadataObject,
  onChange,
}) => {
  const [externalIdFieldOptions, setExternalIdFieldOptions] = useState<ListItem<string, FieldWithRelatedEntities>[]>(() =>
    externalIdFields.map((field) => ({
      id: field.name,
      label: field.label,
      value: field.name,
      meta: field,
    })),
  );
  const [externalId, setExternalId] = useState(externalIdInit || '');
  const [externalIdNoItemsText, setExternalIdNoItemsText] = useState('');
  const allowedLoadTypes = useAllowedLoadTypes();
  // Custom metadata is always an upsert, gated by the metadata deploy operation instead of the record operations
  const visibleLoadTypeOptions = isCustomMetadataObject
    ? LOAD_TYPE_OPTIONS
    : LOAD_TYPE_OPTIONS.filter(({ value }) => allowedLoadTypes.includes(value));

  useEffect(() => {
    if (externalIdFields && externalIdFields.length) {
      setExternalIdNoItemsText('Select an object before selecting an external Id');
    } else {
      setExternalIdNoItemsText('There are no items for selection');
    }
    if (Array.isArray(externalIdFields) && externalId) {
      if (!externalIdFields.some((field) => field.name === externalId)) {
        setExternalId('');
      }
    }
    setExternalIdFieldOptions(
      (externalIdFields || []).map((field) => ({
        id: field.name,
        label: field.label,
        value: field.name,
        meta: field,
      })),
    );
  }, [externalId, externalIdFields]);

  function handleChange(type: InsertUpdateUpsertDelete) {
    if (type === 'UPSERT') {
      onChange(type, externalId || null);
    } else {
      onChange(type, undefined);
    }
  }

  function handleExternalIdChange(value: string) {
    setExternalId(value);
    onChange(selectedType, value || null);
  }

  return (
    <>
      <Grid testId="load-type" verticalAlign="end">
        <GridCol growNone>
          {visibleLoadTypeOptions.length ? (
            <RadioGroup label="Type of Data Load" required isButtonGroup>
              {visibleLoadTypeOptions.map(({ value, label }) => (
                <RadioButton
                  key={value}
                  name={value}
                  label={label}
                  value={value}
                  checked={selectedType === value}
                  disabled={isCustomMetadataObject}
                  onChange={() => handleChange(value)}
                />
              ))}
            </RadioGroup>
          ) : (
            <ScopedNotification theme="info">{LOAD_NOT_ALLOWED_MESSAGE}</ScopedNotification>
          )}
        </GridCol>
        {selectedType === 'UPSERT' && !isCustomMetadataObject && (
          <GridCol>
            <div className="slds-is-relative">
              {loadingFields && <Spinner size="small" />}
              <ComboboxWithItems
                comboboxProps={{
                  label: 'External Id',
                  noItemsPlaceholder: externalIdNoItemsText,
                  labelHelp:
                    'Upsert requires an external Id as an alternative to a record id for matching rows in your input data to records in Salesforce. If a match is found, the record will be updated. Otherwise a new record will be created.',
                }}
                items={externalIdFieldOptions}
                selectedItemId={externalId}
                onSelected={(item) => handleExternalIdChange(item.id)}
              />
            </div>
          </GridCol>
        )}
      </Grid>
      {selectedType === 'HARD_DELETE' && (
        <p className="slds-p-top_xx-small slds-p-left_small text-color_warning">
          Hard Delete skips the Recycle Bin and requires the <strong>"Bulk API Hard Delete"</strong> system permission.
        </p>
      )}
    </>
  );
};

export default LoadRecordsLoadTypeButtons;
