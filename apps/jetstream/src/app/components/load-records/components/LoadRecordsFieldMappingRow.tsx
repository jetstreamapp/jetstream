/** @jsx jsx */
import { jsx } from '@emotion/react';
import { multiWordObjectFilter } from '@jetstream/shared/utils';
import { Checkbox, Combobox, ComboboxListItem, Grid, Icon } from '@jetstream/ui';
import classNames from 'classnames';
import isNil from 'lodash/isNil';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { FieldMappingItem, FieldRelatedEntity, FieldWithRelatedEntities } from '../load-records-types';

function getPreviewData(csvRowData: string | Date | boolean | number | null): string {
  if (isNil(csvRowData)) {
    return '';
  }
  if (csvRowData instanceof Date) {
    return csvRowData.toJSON();
  }
  return `${csvRowData}`;
}

function getComboboxFieldName(fieldMappingItem: FieldMappingItem) {
  if (!fieldMappingItem || !fieldMappingItem.targetField) {
    return undefined;
  }
  return `${fieldMappingItem.fieldMetadata.label} (${fieldMappingItem.targetField})`;
}

function getComboboxFieldTitle(fieldMappingItem: FieldMappingItem) {
  if (!fieldMappingItem || !fieldMappingItem.targetField) {
    return undefined;
  }
  return `${fieldMappingItem.fieldMetadata.label} (${fieldMappingItem.targetField}) - ${fieldMappingItem.fieldMetadata.typeLabel}`;
}

function getComboboxRelatedFieldName(relatedFieldMetadata: FieldRelatedEntity) {
  if (!relatedFieldMetadata) {
    return undefined;
  }
  return `${relatedFieldMetadata.label} (${relatedFieldMetadata.name})`;
}

export interface LoadRecordsFieldMappingRowProps {
  fields: FieldWithRelatedEntities[];
  fieldMappingItem: FieldMappingItem;
  csvField: string;
  csvRowData: string;
  onSelectionChanged: (csvField: string, fieldMappingItem: FieldMappingItem) => void;
}

export const LoadRecordsFieldMappingRow: FunctionComponent<LoadRecordsFieldMappingRowProps> = ({
  fields,
  fieldMappingItem,
  csvField,
  csvRowData,
  onSelectionChanged,
}) => {
  const [textFilter, setTextFilter] = useState<string>('');
  const [visibleFields, setVisibleFields] = useState(fields);

  const [relatedTextFilter, setRelatedTextFilter] = useState<string>('');
  const [visibleRelatedFields, setVisibleRelatedFields] = useState<FieldRelatedEntity[]>([]);

  useEffect(() => {
    if (!textFilter && fields.length !== visibleFields.length) {
      setVisibleFields(fields);
    } else if (textFilter) {
      setVisibleFields(fields.filter(multiWordObjectFilter(['name', 'label'], textFilter)));
    }
  }, [fields, textFilter]);

  // EXTERNAL ID FILTER
  useEffect(() => {
    if (fieldMappingItem.fieldMetadata) {
      if (
        !relatedTextFilter &&
        Array.isArray(fieldMappingItem.fieldMetadata.relatedFields) &&
        fieldMappingItem.fieldMetadata.relatedFields.length !== visibleRelatedFields.length
      ) {
        setVisibleRelatedFields(fieldMappingItem.fieldMetadata.relatedFields);
      } else if (relatedTextFilter) {
        setVisibleRelatedFields(
          fieldMappingItem.fieldMetadata.relatedFields.filter(multiWordObjectFilter(['name', 'label'], relatedTextFilter))
        );
      }
    }
  }, [fieldMappingItem, relatedTextFilter]);

  function handleSelectionChanged(field: FieldWithRelatedEntities) {
    if (!field) {
      onSelectionChanged(csvField, {
        csvField,
        targetField: null,
        mappedToLookup: false,
        fieldMetadata: undefined,
      });
    } else if (field.name !== fieldMappingItem.targetField) {
      onSelectionChanged(csvField, {
        ...fieldMappingItem,
        targetField: field.name,
        mappedToLookup: false,
        targetLookupField: undefined,
        relationshipName: field.relationshipName,
        fieldMetadata: field,
      });
    }
  }

  function handleRelatedSelectionChanged(field: FieldRelatedEntity) {
    onSelectionChanged(csvField, {
      ...fieldMappingItem,
      mappedToLookup: true,
      targetLookupField: field.name,
      relatedFieldMetadata: field,
      relationshipName: fieldMappingItem.fieldMetadata.relationshipName,
    });
  }

  function handleMapToRelatedChanged(value: boolean) {
    onSelectionChanged(csvField, {
      ...fieldMappingItem,
      mappedToLookup: value,
    });
  }

  const csvRowDataStr = getPreviewData(csvRowData);

  function handleInputChange(value: string) {
    if (value !== textFilter) {
      setTextFilter(value);
    }
  }

  return (
    <tr>
      <td className="slds-align-top slds-text-color_weak bg-color-backdrop-tint">
        <div className="slds-truncate slds-m-top_x-small" title={csvRowDataStr}>
          {csvRowDataStr}
        </div>
      </td>
      <th scope="row" className="slds-align-top">
        <div className="slds-truncate slds-m-top_x-small" title={csvField}>
          {csvField}
        </div>
      </th>
      <td className="slds-align-top">
        {fieldMappingItem.targetField && (
          <Icon
            type="utility"
            icon="success"
            className="slds-icon slds-icon-text-success slds-icon_x-small slds-m-top_x-small"
            containerClassname="slds-icon_container slds-icon-utility-success"
            description="field is mapped"
          />
        )}
      </td>
      <td>
        <Combobox
          label="Salesforce Fields"
          selectedItemLabel={getComboboxFieldName(fieldMappingItem)}
          selectedItemTitle={getComboboxFieldTitle(fieldMappingItem)}
          hideLabel
          onInputChange={handleInputChange}
          hasError={fieldMappingItem.isDuplicateMappedField}
          errorMessageId={`${csvField}-${fieldMappingItem.targetField}-duplicate-field-error`}
          errorMessage="Each Salesforce field should only be mapped once"
        >
          {visibleFields.map((field) => (
            <ComboboxListItem
              key={field.name}
              id={`${csvField}-${field.name}`}
              selected={field.name === fieldMappingItem.targetField}
              onSelection={(value) => handleSelectionChanged(field)}
            >
              <span className="slds-listbox__option-text slds-listbox__option-text_entity">
                <Grid align="spread">
                  <span title={field.label} className="slds-truncate">
                    {field.label}
                  </span>
                  <span className="slds-badge slds-badge_lightest slds-truncate" title="field.typeLabel">
                    {field.typeLabel}
                  </span>
                </Grid>
              </span>
              <span className="slds-listbox__option-meta slds-listbox__option-meta_entity">
                <span title={field.name} className="slds-truncate">
                  {field.name}
                </span>
              </span>
            </ComboboxListItem>
          ))}
        </Combobox>
        {fieldMappingItem.targetField && Array.isArray(fieldMappingItem.fieldMetadata.relatedFields) && (
          <Fragment>
            <div>
              <Checkbox
                id={`${csvField}-${fieldMappingItem.targetField}-map-to-related`}
                checked={fieldMappingItem.mappedToLookup}
                label={'Map to External Id'}
                labelHelp="You can choose an external Id on the related record instead of the Id to indicate which related record should be associated"
                onChange={handleMapToRelatedChanged}
              />
            </div>
            {fieldMappingItem.mappedToLookup && (
              <Combobox
                label="Related External Id Fields"
                selectedItemLabel={getComboboxRelatedFieldName(fieldMappingItem.relatedFieldMetadata)}
                selectedItemTitle={getComboboxRelatedFieldName(fieldMappingItem.relatedFieldMetadata)}
                hideLabel
                onInputChange={setRelatedTextFilter}
              >
                {visibleRelatedFields.map((field) => (
                  <ComboboxListItem
                    key={field.name}
                    id={`${csvField}-${field.name}-related`}
                    selected={field.name === fieldMappingItem.targetLookupField}
                    onSelection={(value) => handleRelatedSelectionChanged(field)}
                  >
                    <span className="slds-listbox__option-text slds-listbox__option-text_entity">
                      <Grid align="spread">
                        <span title={field.label} className="slds-truncate">
                          {field.label}
                        </span>
                      </Grid>
                    </span>
                    <span className="slds-listbox__option-meta slds-listbox__option-meta_entity">
                      <span title={field.name} className="slds-truncate">
                        {field.name}
                      </span>
                    </span>
                  </ComboboxListItem>
                ))}
              </Combobox>
            )}
          </Fragment>
        )}
      </td>
      <td className="slds-align-top">
        <div>
          <button
            className={classNames('slds-button slds-button_icon slds-button_icon-border', {
              'slds-button_icon-error': fieldMappingItem.targetField,
            })}
            title="Clear mapping"
            onClick={() => {
              handleSelectionChanged(null);
            }}
            disabled={!fieldMappingItem.targetField}
          >
            <Icon type="utility" icon="clear" className="slds-button__icon" omitContainer />
            <span className="slds-assistive-text">Clear Mapping</span>
          </button>
        </div>
      </td>
    </tr>
  );
};

export default LoadRecordsFieldMappingRow;
