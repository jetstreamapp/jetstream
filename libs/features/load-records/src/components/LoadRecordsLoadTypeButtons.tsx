import { FieldWithRelatedEntities, InsertUpdateUpsertDelete, ListItem, Maybe } from '@jetstream/types';
import { ComboboxWithItems, Grid, GridCol, RadioButton, RadioGroup, Spinner } from '@jetstream/ui';
import { FunctionComponent, useEffect, useState } from 'react';

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
    }))
  );
  const [externalId, setExternalId] = useState(externalIdInit || '');
  const [externalIdNoItemsText, setExternalIdNoItemsText] = useState('');

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
      }))
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
    <Grid testId="load-type" verticalAlign="end">
      <GridCol growNone>
        <RadioGroup label="Type of Data Load" required isButtonGroup>
          <RadioButton
            name="INSERT"
            label="Insert"
            value="INSERT"
            checked={selectedType === 'INSERT'}
            disabled={isCustomMetadataObject}
            onChange={(value) => handleChange(value as InsertUpdateUpsertDelete)}
          />
          <RadioButton
            name="UPDATE"
            label="Update"
            value="UPDATE"
            checked={selectedType === 'UPDATE'}
            disabled={isCustomMetadataObject}
            onChange={(value) => handleChange(value as InsertUpdateUpsertDelete)}
          />
          <RadioButton
            name="UPSERT"
            label="Upsert"
            value="UPSERT"
            checked={selectedType === 'UPSERT'}
            disabled={isCustomMetadataObject}
            onChange={(value) => handleChange(value as InsertUpdateUpsertDelete)}
          />
          <RadioButton
            name="DELETE"
            label="Delete"
            value="DELETE"
            checked={selectedType === 'DELETE'}
            disabled={isCustomMetadataObject}
            onChange={(value) => handleChange(value as InsertUpdateUpsertDelete)}
          />
        </RadioGroup>
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
  );
};

export default LoadRecordsLoadTypeButtons;
