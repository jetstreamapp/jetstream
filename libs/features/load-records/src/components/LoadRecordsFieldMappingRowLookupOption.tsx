import { FieldMappingItem, NonExtIdLookupOption } from '@jetstream/types';
import { Checkbox, Radio, RadioGroup } from '@jetstream/ui';
import { FunctionComponent } from 'react';

export interface LoadRecordsFieldMappingRowLookupOptionProps {
  fieldMappingItem: FieldMappingItem;
  csvField: string;
  disabled: boolean;
  onSelectionChanged: (csvField: string, fieldMappingItem: FieldMappingItem) => void;
}

export const LoadRecordsFieldMappingRowLookupOption: FunctionComponent<LoadRecordsFieldMappingRowLookupOptionProps> = ({
  fieldMappingItem,
  csvField,
  disabled,
  onSelectionChanged,
}) => {
  function handleLookupOptionChange(lookupOptionUseFirstMatch: NonExtIdLookupOption) {
    onSelectionChanged(csvField, { ...fieldMappingItem, lookupOptionUseFirstMatch });
  }

  function handleLookupOptionNullIfNoMatch(lookupOptionNullIfNoMatch: boolean) {
    onSelectionChanged(csvField, { ...fieldMappingItem, lookupOptionNullIfNoMatch } as FieldMappingItem);
  }

  const idPrefix = `multiple-match-${fieldMappingItem.csvField}`;

  return (
    <div className="slds-cell-wrap">
      <RadioGroup
        className="slds-m-top_small"
        idPrefix={idPrefix}
        label="Map to Lookup Options"
        helpText={
          disabled
            ? 'Salesforce will handle mapping your record to the related record using the External Id.'
            : 'Jetstream will find the related record Ids before loading your file into Salesforce. If you have a large file or a lot of mapped lookups, this may take a few minutes.'
        }
        helpTextClassName="slds-m-top_x-small slds-text-color_weak"
      >
        <Radio
          idPrefix={idPrefix}
          id={`${idPrefix}-first`}
          name={idPrefix}
          label="Use first found record if multiple matches"
          value="FIRST"
          checked={fieldMappingItem.lookupOptionUseFirstMatch === 'FIRST'}
          disabled={disabled}
          onChange={handleLookupOptionChange as (value: string) => void}
        />
        <Radio
          idPrefix={idPrefix}
          id={`${idPrefix}-error`}
          name={idPrefix}
          label="Mark record as failed if multiple matches found"
          value="ERROR_IF_MULTIPLE"
          checked={fieldMappingItem.lookupOptionUseFirstMatch === 'ERROR_IF_MULTIPLE'}
          disabled={disabled}
          onChange={handleLookupOptionChange as (value: string) => void}
        />
        <Checkbox
          id={`${idPrefix}-null-if-no-match`}
          label="Set value to null if no match is found"
          labelHelp="Set value to null if no lookup found, otherwise the record will be marked as failed."
          checked={fieldMappingItem.lookupOptionNullIfNoMatch}
          disabled={disabled}
          onChange={handleLookupOptionNullIfNoMatch}
        />
      </RadioGroup>
    </div>
  );
};

export default LoadRecordsFieldMappingRowLookupOption;
