/** @jsx jsx */
import { jsx } from '@emotion/core';
import { Combobox, ComboboxListItem, Icon } from '@jetstream/ui';
import { FunctionComponent, useEffect, useState } from 'react';
import { EntityParticleRecordWithRelatedExtIds, FieldMappingItem } from '../load-records-types';
import classNames from 'classnames';
import isNil from 'lodash/isNil';

function getPreviewData(csvRowData: string | Date | boolean | number | null): string {
  if (isNil(csvRowData)) {
    return '';
  }
  if (csvRowData instanceof Date) {
    return csvRowData.toJSON();
  }
  return `${csvRowData}`;
}

export interface LoadRecordsFieldMappingRowProps {
  fields: EntityParticleRecordWithRelatedExtIds[];
  fieldMappingItem: FieldMappingItem;
  csvField: string;
  csvRowData: string;
  // TODO: add relatedField
  onSelectionChanged: (csvField: string, field: string, relatedField?: string) => void;
}

export const LoadRecordsFieldMappingRow: FunctionComponent<LoadRecordsFieldMappingRowProps> = ({
  fields,
  fieldMappingItem: fieldMappingItemTemp,
  csvField,
  csvRowData,
  onSelectionChanged,
}) => {
  const [textFilter, setTextFilter] = useState<string>('');
  const [visibleFields, setVisibleFields] = useState(fields);
  const [fieldMappingItem, setFieldMappingItem] = useState<FieldMappingItem>(() => ({ ...fieldMappingItemTemp }));

  useEffect(() => {
    if (!textFilter && fields.length !== visibleFields.length) {
      setVisibleFields(fields);
    } else if (textFilter) {
      const filter = textFilter.toLowerCase().trim();
      setVisibleFields(fields.filter((field) => `${field.Label.toLowerCase()}${field.QualifiedApiName.toLowerCase()}`.includes(filter)));
    }
  }, [fields, textFilter]);

  function handleSelectionChanged(csvField: string, field: string) {
    setFieldMappingItem({ ...fieldMappingItem, targetField: field });
    onSelectionChanged(csvField, field);
  }

  const csvRowDataStr = getPreviewData(csvRowData);

  return (
    <tr>
      <td>
        <div className="slds-truncate" title={csvRowDataStr}>
          {csvRowDataStr}
        </div>
      </td>
      <th scope="row">
        <div className="slds-truncate" title={csvField}>
          {csvField}
        </div>
      </th>
      <td>
        {fieldMappingItem.targetField && (
          <Icon
            type="utility"
            icon="success"
            className="slds-icon slds-icon-text-success slds-icon_x-small"
            containerClassname="slds-icon_container slds-icon-utility-success"
            description="field is mapped"
          />
        )}
      </td>
      <td>
        <Combobox
          label="Salesforce Fields"
          selectedItemLabel={fieldMappingItem.targetField}
          selectedItemTitle={fieldMappingItem.targetField}
          hideLabel
          onInputChange={setTextFilter}
        >
          {visibleFields.map((field) => (
            <ComboboxListItem
              key={field.QualifiedApiName}
              id={field.QualifiedApiName}
              selected={field.QualifiedApiName === fieldMappingItem.targetField}
              onSelection={(value) => handleSelectionChanged(csvField, value)}
            >
              <span className="slds-listbox__option-text slds-listbox__option-text_entity">
                <span title={field.Label} className="slds-truncate">
                  {field.Label}
                </span>
              </span>
              <span className="slds-listbox__option-meta slds-listbox__option-meta_entity">
                <span title={field.QualifiedApiName} className="slds-truncate">
                  {field.QualifiedApiName}
                </span>
              </span>
            </ComboboxListItem>
          ))}
        </Combobox>
      </td>
      <td>
        <div>
          <button
            className={classNames('slds-button slds-button_icon slds-button_icon-border', {
              'slds-button_icon-error': fieldMappingItem.targetField,
            })}
            title="Clear mapping"
            onClick={() => {
              handleSelectionChanged(csvField, null);
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
