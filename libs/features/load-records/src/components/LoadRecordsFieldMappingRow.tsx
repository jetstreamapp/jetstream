import { css } from '@emotion/react';
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { FieldMappingItemCsv, FieldWithRelatedEntities, ListItem, Maybe, SalesforceOrgUi } from '@jetstream/types';
import { Checkbox, ComboboxWithItems, Icon } from '@jetstream/ui';
import classNames from 'classnames';
import isNil from 'lodash/isNil';
import { Fragment, FunctionComponent, useState } from 'react';
import { LoadRecordsFieldMappingRelatedObject } from './LoadRecordsFieldMappingRelatedObject';

function getPreviewData(csvRowData: string | Date | boolean | number | null): string {
  if (isNil(csvRowData)) {
    return '';
  }
  if (csvRowData instanceof Date) {
    return csvRowData.toJSON();
  }
  return `${csvRowData}`;
}

function getComboboxFieldName(item: ListItem) {
  return `${item.label} (${item.value})`;
}

function getComboboxFieldTitle(item: ListItem) {
  return `${item.label} (${item.value}) - ${item.secondaryLabel}`;
}

export interface LoadRecordsFieldMappingRowProps {
  org: SalesforceOrgUi;
  isCustomMetadataObject: boolean;
  fields: FieldWithRelatedEntities[];
  fieldMappingItem: FieldMappingItemCsv;
  csvField: string;
  csvRowData: string;
  binaryAttachmentBodyField?: string;
  onSelectionChanged: (csvField: string, fieldMappingItem: FieldMappingItemCsv) => void;
}

function getFieldListItems(fields: FieldWithRelatedEntities[]) {
  return fields.map(
    (field): ListItem<string, FieldWithRelatedEntities> => ({
      id: field.name,
      label: field.label,
      value: field.name,
      secondaryLabel: field.name,
      secondaryLabelOnNewLine: true,
      tertiaryLabel: field.typeLabel,
      meta: field,
    }),
  );
}

export const LoadRecordsFieldMappingRow: FunctionComponent<LoadRecordsFieldMappingRowProps> = ({
  org,
  isCustomMetadataObject,
  fields,
  fieldMappingItem,
  csvField,
  csvRowData,
  binaryAttachmentBodyField,
  onSelectionChanged,
}) => {
  const [fieldListItems, setFieldListItems] = useState<ListItem<string, FieldWithRelatedEntities>[]>(() => getFieldListItems(fields));

  useNonInitialEffect(() => {
    setFieldListItems(getFieldListItems(fields));
  }, [fields]);

  function handleSelectionChanged(field: Maybe<FieldWithRelatedEntities>) {
    if (!field) {
      onSelectionChanged(csvField, {
        type: 'CSV',
        csvField,
        targetField: null,
        mappedToLookup: false,
        fieldMetadata: undefined,
        selectedReferenceTo: undefined,
        lookupOptionUseFirstMatch: 'ERROR_IF_MULTIPLE',
        lookupOptionNullIfNoMatch: false,
        isBinaryBodyField: false,
      });
    } else if (field.name !== fieldMappingItem.targetField) {
      onSelectionChanged(csvField, {
        ...fieldMappingItem,
        targetField: field.name,
        mappedToLookup: false,
        targetLookupField: undefined,
        relationshipName: field.relationshipName,
        fieldMetadata: field,
        isBinaryBodyField: !!binaryAttachmentBodyField && field.name === binaryAttachmentBodyField,
      });
    }
  }

  function handleMapToRelatedChanged(value: boolean) {
    const referenceToItems = fieldMappingItem.fieldMetadata?.referenceTo || [];
    let selectedReferenceTo = referenceToItems[0];
    if (fieldMappingItem.selectedReferenceTo && referenceToItems.includes(fieldMappingItem.selectedReferenceTo)) {
      selectedReferenceTo = fieldMappingItem.selectedReferenceTo;
    }
    onSelectionChanged(csvField, {
      ...fieldMappingItem,
      mappedToLookup: value,
      selectedReferenceTo,
    });
  }

  const csvRowDataStr = getPreviewData(csvRowData);

  const isLookup = fieldMappingItem.targetField && Array.isArray(fieldMappingItem.fieldMetadata?.referenceTo);

  return (
    <tr>
      <td
        className="slds-align-top slds-text-color_weak bg-color-backdrop-tint"
        css={css`
          width: 200px;
          max-width: 200px;
        `}
      >
        <div
          css={css`
            line-break: anywhere;
          `}
          className="slds-line-clamp_medium slds-m-top_x-small"
          title={csvRowDataStr}
        >
          {csvRowDataStr}
        </div>
      </td>
      <th scope="row" className="slds-align-top">
        <div className="slds-line-clamp_medium slds-m-top_x-small" title={csvField}>
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
            hasError: !!fieldMappingItem.fieldErrorMsg,
            errorMessage: fieldMappingItem.fieldErrorMsg,
            errorMessageId: `${csvField}-${fieldMappingItem.targetField}-mapping-error`,
          }}
          items={fieldListItems}
          selectedItemId={fieldMappingItem.targetField}
          selectedItemLabelFn={getComboboxFieldName}
          selectedItemTitleFn={getComboboxFieldTitle}
          onSelected={(item) => handleSelectionChanged(item.meta)}
        />
        {isLookup && isCustomMetadataObject && (
          <div
            css={css`
              white-space: pre-wrap;
              overflow-wrap: anywhere;
            `}
          >
            <Icon type="utility" icon="info" className="slds-icon slds-icon-text-default slds-icon_xx-small cursor-pointer" />
            <span className="slds-m-left_x-small text-color_warning">
              Custom Metadata lookup fields use the related record DeveloperName, not Id.
            </span>
          </div>
        )}
        {isLookup && !isCustomMetadataObject && (
          <Fragment>
            <div>
              <Checkbox
                id={`${csvField}-${fieldMappingItem.targetField}-map-to-related`}
                checked={fieldMappingItem.mappedToLookup}
                label="Map using related field"
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
              <LoadRecordsFieldMappingRelatedObject
                org={org}
                fieldMappingItem={fieldMappingItem}
                csvField={csvField}
                onSelectionChanged={onSelectionChanged}
              />
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
