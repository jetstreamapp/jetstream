import { SalesforceOrgUi } from '@jetstream/types';
import { Grid, Icon, Tooltip } from '@jetstream/ui';
import {
  FieldDefinitionType,
  FieldValue,
  FieldValues,
  SalesforceFieldType,
  baseFields,
  fieldDefinitions,
  fieldTypeDependencies,
  getAdditionalFieldDependencies,
} from '@jetstream/ui-core';
import { FunctionComponent } from 'react';
import CreateFieldsRowField from './CreateFieldsRowField';
import CreateFieldsRowPicklistOption from './CreateFieldsRowPicklistOption';

const TYPE_PICKLIST = new Set<SalesforceFieldType>(['Picklist', 'MultiselectPicklist']);

export interface CreateFieldsRowProps {
  rowIdx: number;
  enableDelete?: boolean;
  selectedOrg: SalesforceOrgUi;
  selectedSObjects: string[];
  values: FieldValues;
  allValid: boolean;
  rows: FieldValues[];
  onChange: (field: FieldDefinitionType, value: FieldValue) => void;
  onClone: () => void;
  onDelete: () => void;
  onBlur: (field: FieldDefinitionType) => void;
  onChangePicklistOption: (value: boolean) => void;
}

export const CreateFieldsRow: FunctionComponent<CreateFieldsRowProps> = ({
  rowIdx,
  enableDelete,
  selectedOrg,
  selectedSObjects,
  values,
  allValid,
  rows,
  onChange,
  onClone,
  onDelete,
  onBlur,
  onChangePicklistOption,
}) => {
  function handleChange(field: FieldDefinitionType, value: FieldValue) {
    onChange(field, value);
  }

  return (
    <div className="slds-box slds-box_small slds-m-bottom_xx-small">
      <Grid wrap>
        {baseFields.map((field) => (
          <CreateFieldsRowField
            key={field}
            selectedOrg={selectedOrg}
            selectedSObjects={selectedSObjects}
            rows={rows}
            id={`field-${rowIdx}-${field}`}
            fieldDefinitions={fieldDefinitions}
            field={fieldDefinitions[field]}
            allValues={values}
            valueState={values[field]}
            disabled={false}
            onChange={(value) => handleChange(field, value)}
            onBlur={() => onBlur(field)}
          />
        ))}
        {values.type && TYPE_PICKLIST.has(values.type.value as SalesforceFieldType) && (
          <CreateFieldsRowPicklistOption
            rowIdx={rowIdx}
            selectedOrg={selectedOrg}
            selectedSObjects={selectedSObjects}
            rows={rows}
            values={values}
            fieldDefinitions={fieldDefinitions}
            disabled={false}
            onChangePicklistOption={onChangePicklistOption}
            onChange={handleChange}
            onBlur={onBlur}
          />
        )}
        {values.type &&
          fieldTypeDependencies[values.type.value as SalesforceFieldType].map((field) => (
            <CreateFieldsRowField
              key={field}
              selectedOrg={selectedOrg}
              selectedSObjects={selectedSObjects}
              rows={rows}
              id={`field-${rowIdx}-${field}`}
              fieldDefinitions={fieldDefinitions}
              field={fieldDefinitions[field]}
              allValues={values}
              valueState={values[field]}
              disabled={false}
              onChange={(value) => handleChange(field, value)}
              onBlur={() => onBlur(field)}
            />
          ))}
        {getAdditionalFieldDependencies(values).map((field) => (
          <CreateFieldsRowField
            key={field}
            selectedOrg={selectedOrg}
            selectedSObjects={selectedSObjects}
            rows={rows}
            id={`field-${rowIdx}-${field}`}
            fieldDefinitions={fieldDefinitions}
            field={fieldDefinitions[field]}
            allValues={values}
            valueState={values[field]}
            disabled={false}
            onChange={(value) => handleChange(field, value)}
            onBlur={() => onBlur(field)}
          />
        ))}
      </Grid>
      <Grid className="slds-m-top_small" align="spread" verticalAlign="end">
        <div>
          <button className="slds-button" onClick={() => onClone()}>
            <Icon type="utility" icon="add" className="slds-button__icon slds-button__icon_left" omitContainer />
            Clone
          </button>
        </div>
        <div>
          {!allValid && (
            <Grid className="slds-text-color_weak">
              <Tooltip content="Field is not yet configured">
                <Icon
                  type="utility"
                  icon="error"
                  className="slds-icon slds-icon-text-error slds-icon_xx-small"
                  containerClassname="slds-icon_container slds-icon-utility-error"
                  description="Field is not yet configured"
                />
              </Tooltip>
            </Grid>
          )}
          {allValid && (
            <Tooltip content="Field is fully configured">
              <Icon
                type="utility"
                icon="success"
                className="slds-icon slds-icon-text-success slds-icon_x-small"
                containerClassname="slds-icon_container slds-icon-utility-success"
                description="Field is configured properly"
              />
            </Tooltip>
          )}
        </div>
        <div>
          {enableDelete && (
            <button className="slds-button slds-button_text-destructive" onClick={() => onDelete()}>
              <Icon type="utility" icon="delete" className="slds-button__icon slds-button__icon_left" omitContainer />
              Delete
            </button>
          )}
        </div>
      </Grid>
    </div>
  );
};

export default CreateFieldsRow;
