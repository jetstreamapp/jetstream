import { multiWordObjectFilter } from '@jetstream/shared/utils';
import { InsertUpdateUpsertDelete } from '@jetstream/types';
import { Combobox, ComboboxListItem, Grid, GridCol, RadioButton, RadioGroup, Spinner } from '@jetstream/ui';
import { FunctionComponent, useEffect, useState } from 'react';
import { FieldWithRelatedEntities } from '../load-records-types';

export interface LoadRecordsLoadTypeButtonsProps {
  selectedType: InsertUpdateUpsertDelete;
  loadingFields: boolean;
  externalIdFields: FieldWithRelatedEntities[];
  externalId: string;
  isCustomMetadataObject: boolean;
  onChange: (type: InsertUpdateUpsertDelete, externalId: string) => void;
}

export const LoadRecordsLoadTypeButtons: FunctionComponent<LoadRecordsLoadTypeButtonsProps> = ({
  selectedType = 'INSERT',
  loadingFields,
  externalIdFields,
  externalId: externalIdInit,
  isCustomMetadataObject,
  onChange,
}) => {
  const [textFilter, setTextFilter] = useState<string>('');
  const [visibleExternalIdFields, setVisibleExternalIds] = useState(() => [...externalIdFields]);
  const [externalId, setExternalId] = useState(externalIdInit || '');
  const [externalIdNoItemsText, setExternalIdNoItemsText] = useState('');

  useEffect(() => {
    if (!textFilter && visibleExternalIdFields.length !== externalIdFields.length) {
      setVisibleExternalIds(externalIdFields);
    } else if (textFilter) {
      setVisibleExternalIds(externalIdFields.filter(multiWordObjectFilter(['name', 'label'], textFilter)));
    }
  }, [externalIdFields, textFilter]);

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
  }, [externalIdFields]);

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
    <Grid verticalAlign="end">
      <GridCol growNone>
        <RadioGroup label="Type of Data Load" required isButtonGroup>
          <RadioButton
            name="INSERT"
            label="Insert"
            value="INSERT"
            checked={selectedType === 'INSERT'}
            disabled={isCustomMetadataObject}
            onChange={handleChange}
          />
          <RadioButton
            name="UPDATE"
            label="Update"
            value="UPDATE"
            checked={selectedType === 'UPDATE'}
            disabled={isCustomMetadataObject}
            onChange={handleChange}
          />
          <RadioButton
            name="UPSERT"
            label="Upsert"
            value="UPSERT"
            checked={selectedType === 'UPSERT'}
            disabled={isCustomMetadataObject}
            onChange={handleChange}
          />
          <RadioButton
            name="DELETE"
            label="Delete"
            value="DELETE"
            checked={selectedType === 'DELETE'}
            disabled={isCustomMetadataObject}
            onChange={handleChange}
          />
        </RadioGroup>
      </GridCol>
      {selectedType === 'UPSERT' && !isCustomMetadataObject && (
        <GridCol>
          <div className="slds-is-relative">
            {loadingFields && <Spinner size="small" />}
            <Combobox
              label="External Id"
              selectedItemLabel={externalId}
              selectedItemTitle={externalId}
              noItemsPlaceholder={externalIdNoItemsText}
              onInputChange={setTextFilter}
              labelHelp="Upsert requires an external Id as an alternative to a record id for matching rows in your input data to records in Salesforce. If a match is found, the record will be updated. Otherwise a new record will be created."
            >
              {visibleExternalIdFields.map((field) => (
                <ComboboxListItem
                  key={field.name}
                  id={field.name}
                  selected={field.name === externalId}
                  onSelection={handleExternalIdChange}
                >
                  <span className="slds-listbox__option-text slds-listbox__option-text_entity">
                    <span title={field.label} className="slds-truncate">
                      {field.label}
                    </span>
                  </span>
                  <span className="slds-listbox__option-meta slds-listbox__option-meta_entity">
                    <span title={field.name} className="slds-truncate">
                      {field.name}
                    </span>
                  </span>
                </ComboboxListItem>
              ))}
            </Combobox>
          </div>
        </GridCol>
      )}
    </Grid>
  );
};

export default LoadRecordsLoadTypeButtons;
