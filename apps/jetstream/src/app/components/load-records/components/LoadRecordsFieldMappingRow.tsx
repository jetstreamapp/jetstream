import { multiWordObjectFilter } from '@jetstream/shared/utils';
import { Checkbox, Combobox, ComboboxListItem, Grid, Icon, Select } from '@jetstream/ui';
import classNames from 'classnames';
import isNil from 'lodash/isNil';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { FieldMappingItem, FieldRelatedEntity, FieldWithRelatedEntities } from '../load-records-types';
import LoadRecordsFieldMappingRowLookupOption from './LoadRecordsFieldMappingRowLookupOption';

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
  const [selectedRelatedObject, setSelectedRelatedObject] = useState<string>(fieldMappingItem.selectedReferenceTo);
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
      if (relatedTextFilter) {
        // related object changed, reset filter and related fields
        if (selectedRelatedObject !== fieldMappingItem.selectedReferenceTo) {
          setSelectedRelatedObject(fieldMappingItem.selectedReferenceTo);
          setRelatedTextFilter('');
          setVisibleRelatedFields(fieldMappingItem.fieldMetadata.relatedFields?.[fieldMappingItem.selectedReferenceTo] || []);
        } else {
          // apply filter
          setVisibleRelatedFields(
            fieldMappingItem.fieldMetadata.relatedFields[fieldMappingItem.selectedReferenceTo].filter(
              multiWordObjectFilter(['name', 'label'], relatedTextFilter)
            )
          );
        }
      } else {
        // if reference changed, then reset state
        if (selectedRelatedObject !== fieldMappingItem.selectedReferenceTo) {
          setSelectedRelatedObject(fieldMappingItem.selectedReferenceTo);
          if (fieldMappingItem.selectedReferenceTo) {
            setVisibleRelatedFields(fieldMappingItem.fieldMetadata.relatedFields[fieldMappingItem.selectedReferenceTo]);
          }
          // ensure that all values are shown since there is no filter
        } else if (
          fieldMappingItem.selectedReferenceTo &&
          Array.isArray(fieldMappingItem.fieldMetadata.relatedFields?.[fieldMappingItem.selectedReferenceTo]) &&
          fieldMappingItem.fieldMetadata.relatedFields[fieldMappingItem.selectedReferenceTo].length !== visibleRelatedFields.length
        ) {
          setVisibleRelatedFields(fieldMappingItem.fieldMetadata.relatedFields[fieldMappingItem.selectedReferenceTo]);
        }
      }
    }
  }, [fieldMappingItem, relatedTextFilter, selectedRelatedObject]);

  function handleSelectionChanged(field: FieldWithRelatedEntities) {
    if (!field) {
      onSelectionChanged(csvField, {
        csvField,
        targetField: null,
        mappedToLookup: false,
        fieldMetadata: undefined,
        selectedReferenceTo: undefined,
        lookupOptionUseFirstMatch: 'ERROR_IF_MULTIPLE',
        lookupOptionNullIfNoMatch: false,
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

  function handleRelatedObjectSelectionChanged(field: string) {
    onSelectionChanged(csvField, {
      ...fieldMappingItem,
      mappedToLookup: true,
      selectedReferenceTo: field,
      targetLookupField: undefined,
      relatedFieldMetadata: undefined,
      relationshipName: undefined,
    });
  }

  function handleRelatedSelectionChanged(field: FieldRelatedEntity) {
    const newFieldMappingItem: FieldMappingItem = {
      ...fieldMappingItem,
      mappedToLookup: true,
      targetLookupField: field.name,
      relatedFieldMetadata: field,
      relationshipName: fieldMappingItem.fieldMetadata.relationshipName,
    };

    if (newFieldMappingItem.targetLookupField && newFieldMappingItem.relatedFieldMetadata.isExternalId) {
      newFieldMappingItem.lookupOptionNullIfNoMatch = false;
      newFieldMappingItem.lookupOptionUseFirstMatch = 'ERROR_IF_MULTIPLE';
    }

    onSelectionChanged(csvField, newFieldMappingItem);
  }

  function handleMapToRelatedChanged(value: boolean) {
    onSelectionChanged(csvField, {
      ...fieldMappingItem,
      mappedToLookup: value,
      selectedReferenceTo: fieldMappingItem.selectedReferenceTo || fieldMappingItem.fieldMetadata.referenceTo?.[0],
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
        {fieldMappingItem.targetField && Array.isArray(fieldMappingItem.fieldMetadata.referenceTo) && (
          <Fragment>
            <div>
              <Checkbox
                id={`${csvField}-${fieldMappingItem.targetField}-map-to-related`}
                checked={fieldMappingItem.mappedToLookup}
                label={'Map using related field'}
                labelHelp={
                  <div>
                    <p>You can choose certain fields on the related record instead of the Id to set this lookup.</p>
                    <p className="slds-m-top_x-small">
                      If the field is an External Id then Salesforce will find the related records, otherwise Jetstream will find the
                      related records before loading your file into Salesforce.
                    </p>
                  </div>
                }
                onChange={handleMapToRelatedChanged}
              />
            </div>
            {fieldMappingItem.mappedToLookup && (
              <Fragment>
                <Grid>
                  <div className="slds-m-right_small">
                    <Select
                      id={`${fieldMappingItem.targetField}-related-to`}
                      label="Related Object"
                      isRequired
                      labelHelp={
                        fieldMappingItem.fieldMetadata.referenceTo.length <= 1
                          ? 'This option is only enabled for fields that have more than one related object.'
                          : 'This lookup can point to multiple objects, choose the related object that you are mapping to.'
                      }
                    >
                      <select
                        className="slds-select"
                        id={`${fieldMappingItem.targetField}-related-to`}
                        disabled={fieldMappingItem.fieldMetadata.referenceTo.length <= 1}
                        value={fieldMappingItem.selectedReferenceTo}
                        onChange={(event) => handleRelatedObjectSelectionChanged(event.target.value)}
                      >
                        {fieldMappingItem.fieldMetadata.referenceTo.map((relatedObject) => (
                          <option key={relatedObject} value={relatedObject}>
                            {relatedObject}
                          </option>
                        ))}
                      </select>
                    </Select>
                  </div>
                  <div className="slds-grow">
                    <Combobox
                      label="Related Mappable Fields"
                      selectedItemLabel={getComboboxRelatedFieldName(fieldMappingItem.relatedFieldMetadata)}
                      selectedItemTitle={getComboboxRelatedFieldName(fieldMappingItem.relatedFieldMetadata)}
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
                          {field.isExternalId && (
                            <span className="slds-listbox__option-meta slds-listbox__option-meta_entity">
                              <div title="External Id field" className="slds-truncate">
                                <strong>External Id</strong>
                              </div>
                            </span>
                          )}
                        </ComboboxListItem>
                      ))}
                    </Combobox>
                  </div>
                </Grid>
                {fieldMappingItem.targetLookupField && (
                  <LoadRecordsFieldMappingRowLookupOption
                    csvField={csvField}
                    fieldMappingItem={fieldMappingItem}
                    disabled={fieldMappingItem.relatedFieldMetadata.isExternalId}
                    onSelectionChanged={onSelectionChanged}
                  />
                )}
              </Fragment>
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
