import { css } from '@emotion/react';
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { FieldMappingItemCsv, FieldWithRelatedEntities, ListItem, Maybe, SalesforceOrgUi } from '@jetstream/types';
import { ariaDisabledButtonProps, Checkbox, ComboboxWithItems, Grid, Icon, Tooltip } from '@jetstream/ui';
import classNames from 'classnames';
import isNil from 'lodash/isNil';
import { Fragment, FunctionComponent, MouseEvent, useState } from 'react';
import { getComboboxFieldName, getComboboxFieldTitle, getFieldListItems } from '../utils/field-mapping-utils';
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

export interface LoadRecordsFieldMappingRowProps {
  org: SalesforceOrgUi;
  isCustomMetadataObject: boolean;
  fields: FieldWithRelatedEntities[];
  fieldMappingItem: FieldMappingItemCsv;
  csvField: string;
  /** Key this row occupies in the FieldMapping object. Matches csvField unless this is an additional mapping for an already mapped column. */
  mappingKey: string;
  csvRowData: string;
  binaryAttachmentBodyField?: Maybe<string>;
  /** An additional mapping can be removed, a column's own row can spawn more */
  isAdditionalMapping: boolean;
  onRemoveRow?: (event?: MouseEvent<HTMLButtonElement>) => void;
  onAddAdditionalMapping?: () => void;
  onSelectionChanged: (mappingKey: string, fieldMappingItem: FieldMappingItemCsv) => void;
}

export const LoadRecordsFieldMappingRow: FunctionComponent<LoadRecordsFieldMappingRowProps> = ({
  org,
  isCustomMetadataObject,
  fields,
  fieldMappingItem,
  csvField,
  mappingKey,
  csvRowData,
  binaryAttachmentBodyField,
  isAdditionalMapping,
  onRemoveRow,
  onAddAdditionalMapping,
  onSelectionChanged,
}) => {
  const [fieldListItems, setFieldListItems] = useState<ListItem<string, FieldWithRelatedEntities>[]>(() => getFieldListItems(fields));

  useNonInitialEffect(() => {
    setFieldListItems(getFieldListItems(fields));
  }, [fields]);

  function handleSelectionChanged(field: Maybe<FieldWithRelatedEntities>) {
    if (!field) {
      onSelectionChanged(mappingKey, {
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
      onSelectionChanged(mappingKey, {
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
    onSelectionChanged(mappingKey, {
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
        className="slds-align-top slds-text-color_weak"
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
          {isAdditionalMapping && (
            <Icon
              type="utility"
              icon="arrow_right"
              className="slds-icon slds-icon-text-default slds-icon_xx-small slds-m-right_x-small"
              description="Additional mapping for this field"
            />
          )}
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
            errorMessageId: `${mappingKey}-${fieldMappingItem.targetField}-mapping-error`,
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
                id={`${mappingKey}-${fieldMappingItem.targetField}-map-to-related`}
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
                mappingKey={mappingKey}
                onSelectionChanged={onSelectionChanged}
              />
            )}
          </Fragment>
        )}
      </td>
      <td className="slds-align-top">
        <Grid>
          <button
            className={classNames('slds-button slds-button_icon slds-button_icon-border', {
              'slds-button_icon-error': fieldMappingItem.targetField,
            })}
            title="Clear mapping"
            {...ariaDisabledButtonProps(!fieldMappingItem.targetField, () => handleSelectionChanged(null))}
          >
            <Icon type="utility" icon="clear" className="slds-button__icon" omitContainer />
            <span className="slds-assistive-text">Clear Mapping</span>
          </button>
          {isAdditionalMapping ? (
            <Tooltip content="Remove this additional mapping">
              <button
                className="slds-button slds-button_icon slds-button_icon-border slds-button_icon-error slds-m-left_xx-small"
                onClick={onRemoveRow}
              >
                <Icon type="utility" icon="delete" className="slds-button__icon" omitContainer />
                <span className="slds-assistive-text">Remove Additional Mapping</span>
              </button>
            </Tooltip>
          ) : (
            onAddAdditionalMapping && (
              <Tooltip content={`Map ${csvField} to an additional Salesforce field`}>
                <button
                  className="slds-button slds-button_icon slds-button_icon-border slds-m-left_xx-small"
                  onClick={onAddAdditionalMapping}
                >
                  <Icon type="utility" icon="add" className="slds-button__icon" omitContainer />
                  <span className="slds-assistive-text">Map to another field</span>
                </button>
              </Tooltip>
            )
          )}
        </Grid>
      </td>
    </tr>
  );
};

export default LoadRecordsFieldMappingRow;
