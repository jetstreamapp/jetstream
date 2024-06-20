import { css } from '@emotion/react';
import { EditableFields, UiRecordFormField, convertMetadataToEditableFields } from '@jetstream/record-form';
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { FieldMappingItemStatic, FieldWithRelatedEntities, ListItem, Maybe, PicklistFieldValues } from '@jetstream/types';
import { ComboboxWithItems, Grid, Icon } from '@jetstream/ui';
import { FunctionComponent, useEffect, useId, useState } from 'react';
function getComboboxFieldName(item: ListItem) {
  return `${item.label} (${item.value})`;
}

function getComboboxFieldTitle(item: ListItem) {
  return `${item.label} (${item.value}) - ${item.secondaryLabel}`;
}

export interface LoadRecordsFieldMappingStaticRowProps {
  fields: FieldWithRelatedEntities[];
  fieldMappingItem: FieldMappingItemStatic;
  isCustomMetadata?: boolean;
  onSelectionChanged: (fieldMappingItem: FieldMappingItemStatic) => void;
  onRemoveRow: () => void;
}

function getFieldListItems(fields: FieldWithRelatedEntities[]) {
  return fields.map((field) => ({
    id: field.name,
    label: field.label,
    value: field.name,
    secondaryLabel: field.typeLabel,
    meta: field,
    customRenderer: (item: ListItem<string, FieldWithRelatedEntities>) => (
      <>
        <span className="slds-listbox__option-text slds-listbox__option-text_entity">
          <Grid align="spread">
            <span title={item.label} className="slds-truncate">
              {item.label}
            </span>
            {item.secondaryLabel && (
              <span className="slds-badge slds-badge_lightest slds-truncate" title={item.secondaryLabel}>
                {item.secondaryLabel}
              </span>
            )}
          </Grid>
        </span>
        <span className="slds-listbox__option-meta slds-listbox__option-meta_entity">
          <span title={item.value} className="slds-truncate">
            {item.value}
          </span>
        </span>
      </>
    ),
  }));
}

export const LoadRecordsFieldMappingStaticRow: FunctionComponent<LoadRecordsFieldMappingStaticRowProps> = ({
  fields,
  fieldMappingItem,
  isCustomMetadata,
  onSelectionChanged,
  onRemoveRow,
}) => {
  const errorId = useId();
  const [fieldListItems, setFieldListItems] = useState<ListItem<string, FieldWithRelatedEntities>[]>(() => getFieldListItems(fields));
  const [editableField, setEditableField] = useState<Maybe<EditableFields>>(null);

  useNonInitialEffect(() => {
    setFieldListItems(getFieldListItems(fields));
  }, [fields]);

  useNonInitialEffect(() => {
    if (editableField?.metadata.type === 'boolean') {
      // Ensure field gets set to false otherwise it will not be included unless user changes value
      onSelectionChanged({ ...fieldMappingItem, staticValue: fieldMappingItem.staticValue ?? false });
    } else {
      onSelectionChanged({ ...fieldMappingItem, staticValue: fieldMappingItem.staticValue ?? null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editableField]);

  useEffect(() => {
    if (fieldMappingItem.fieldMetadata?.field) {
      const picklistValues: PicklistFieldValues = {};
      if (fieldMappingItem.fieldMetadata.field.type === 'picklist' || fieldMappingItem.fieldMetadata.field.type === 'multipicklist') {
        picklistValues[fieldMappingItem.fieldMetadata.field.name] = {
          controllerValues: {},
          defaultValue: fieldMappingItem.fieldMetadata.field.picklistValues?.find((value) => value.defaultValue)?.value,
          eTag: '',
          url: '',
          values:
            fieldMappingItem.fieldMetadata.field.picklistValues?.map(({ value, label }) => ({
              value,
              label: label || value,
              attributes: null,
              validFor: null,
            })) || [],
        };
      }
      setEditableField(
        convertMetadataToEditableFields([fieldMappingItem.fieldMetadata.field], picklistValues, 'create', {}, isCustomMetadata)[0]
      );
    }
  }, [fieldMappingItem.fieldMetadata, isCustomMetadata]);

  function handleValueChange(field: EditableFields, staticValue: string | boolean | null) {
    onSelectionChanged({
      ...fieldMappingItem,
      staticValue,
    });
  }

  function handleFieldSelectionChange(field: FieldWithRelatedEntities) {
    if (field.name !== fieldMappingItem.targetField) {
      onSelectionChanged({
        ...fieldMappingItem,
        staticValue: null,
        targetField: field.name,
        mappedToLookup: false,
        targetLookupField: undefined,
        fieldMetadata: field,
      });
    }
  }

  return (
    <tr>
      <th scope="row" colSpan={2} className="slds-align-top slds-text-color_weak bg-color-backdrop-tint">
        {editableField && (
          <UiRecordFormField
            key={fieldMappingItem.targetField}
            field={editableField}
            hideLabel
            initialValue={fieldMappingItem.staticValue}
            modifiedValue={fieldMappingItem.staticValue}
            showFieldTypes={false}
            omitUndoIndicator
            usePortal
            onChange={handleValueChange}
          />
        )}
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
      <td
        css={css`
          min-width: 344px;
          max-width: 344px;
          vertical-align: baseline;
        `}
      >
        <ComboboxWithItems
          comboboxProps={{
            hideLabel: true,
            label: 'Salesforce Fields',
            hasError: fieldMappingItem.isDuplicateMappedField,
            errorMessage: 'Each Salesforce field should only be mapped once',
            errorMessageId: `${errorId}-${fieldMappingItem.targetField}-duplicate-field-error`,
          }}
          items={fieldListItems}
          selectedItemId={fieldMappingItem.targetField}
          selectedItemLabelFn={getComboboxFieldName}
          selectedItemTitleFn={getComboboxFieldTitle}
          onSelected={(item) => handleFieldSelectionChange(item.meta)}
        />
      </td>
      <td className="slds-align-top">
        <div>
          <button
            className="slds-button slds-button_icon slds-button_icon-border slds-button_icon-error"
            title="Delete mapping"
            onClick={() => onRemoveRow()}
          >
            <Icon type="utility" icon="delete" className="slds-button__icon" omitContainer />
            <span className="slds-assistive-text">Delete Mapping</span>
          </button>
        </div>
      </td>
    </tr>
  );
};

export default LoadRecordsFieldMappingStaticRow;
