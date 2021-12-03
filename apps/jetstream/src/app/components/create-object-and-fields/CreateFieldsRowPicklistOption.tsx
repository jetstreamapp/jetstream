import { SalesforceOrgUi } from '@jetstream/types';
import { Checkbox, Grid } from '@jetstream/ui';
import React, { FunctionComponent } from 'react';
import { FieldDefinition, FieldDefinitions, FieldDefinitionType, FieldValue, FieldValues } from './create-fields-types';
import CreateFieldsRowField from './CreateFieldsRowField';

export interface CreateFieldsRowPicklistOptionProps {
  rowIdx: number;
  selectedOrg: SalesforceOrgUi;
  values: FieldValues;
  fieldDefinitions: FieldDefinitions;
  disabled: boolean;
  onChangePicklistOption: (value: boolean) => void;
  onChange: (field: FieldDefinitionType, value: FieldValue) => void;
  onBlur: (field: FieldDefinitionType) => void;
}

export const CreateFieldsRowPicklistOption: FunctionComponent<CreateFieldsRowPicklistOptionProps> = ({
  rowIdx,
  selectedOrg,
  values,
  fieldDefinitions,
  disabled,
  onChangePicklistOption,
  onChange,
  onBlur,
}) => {
  return (
    <Grid>
      <div className="slds-m-right_medium slds-is-relative">
        <Checkbox
          id={`fields-${rowIdx}-picklist-option`}
          checked={values._picklistGlobalValueSet}
          label="Use Global Picklist"
          isStandAlone
          disabled={disabled}
          onChange={onChangePicklistOption}
        />
      </div>
      {values._picklistGlobalValueSet && (
        <CreateFieldsRowField
          selectedOrg={selectedOrg}
          id={`field-${rowIdx}-globalValueSet`}
          fieldDefinitions={fieldDefinitions}
          field={fieldDefinitions.globalValueSet}
          allValues={values}
          valueState={values.globalValueSet}
          disabled={disabled}
          onChange={(value) => onChange('globalValueSet', value)}
          onBlur={() => onBlur('globalValueSet')}
        />
      )}
      <CreateFieldsRowField
        selectedOrg={selectedOrg}
        id={`field-${rowIdx}-valueSet`}
        fieldDefinitions={fieldDefinitions}
        field={fieldDefinitions.valueSet}
        allValues={values}
        valueState={values.valueSet}
        disabled={disabled || values._picklistGlobalValueSet}
        onChange={(value) => onChange('valueSet', value)}
        onBlur={() => onBlur('valueSet')}
      />
    </Grid>
  );
};

export default CreateFieldsRowPicklistOption;
