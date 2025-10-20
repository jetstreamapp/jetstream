import { orderValues } from '@jetstream/shared/utils';
import { FieldMappingItem, FieldMappingItemCsv, FieldRelatedEntity, ListItem, SalesforceOrgUi } from '@jetstream/types';
import { ComboboxWithItems, Grid } from '@jetstream/ui';
import { fetchRelatedFields, SELF_LOOKUP_KEY } from '@jetstream/ui-core';
import { Fragment, FunctionComponent, useEffect, useMemo, useRef, useState } from 'react';
import LoadRecordsFieldMappingRowLookupOption from './LoadRecordsFieldMappingRowLookupOption';

function getComboboxFieldName(item: ListItem) {
  return `${item.label} (${item.value})`;
}

export interface LoadRecordsFieldMappingRelatedObjectProps {
  org: SalesforceOrgUi;
  fieldMappingItem: FieldMappingItemCsv;
  csvField: string;
  onSelectionChanged: (csvField: string, fieldMappingItem: FieldMappingItemCsv) => void;
}

export const LoadRecordsFieldMappingRelatedObject: FunctionComponent<LoadRecordsFieldMappingRelatedObjectProps> = ({
  org,
  fieldMappingItem,
  csvField,
  onSelectionChanged,
}) => {
  const [relatedFields, setRelatedFields] = useState<ListItem<string, FieldRelatedEntity>[]>([]);
  const [loading, setLoading] = useState(false);
  const currentFetchRequest = useRef(0);

  useEffect(() => {
    const currRequest = ++currentFetchRequest.current;
    if (fieldMappingItem.selectedReferenceTo) {
      setLoading(true);
      // TODO: error handling
      fetchRelatedFields(org, fieldMappingItem.selectedReferenceTo)
        .then((fields) => {
          if (currRequest !== currentFetchRequest.current) {
            // outdated request
            return;
          }
          setRelatedFields(
            fields.map((field) => ({
              id: field.name,
              label: field.label,
              value: field.name,
              secondaryLabel: field.name,
              secondaryLabelOnNewLine: true,
              tertiaryLabel: field.isExternalId ? 'External ID' : undefined,
              meta: field,
            })),
          );
        })
        .finally(() => {
          if (currRequest !== currentFetchRequest.current) {
            // outdated request
            return;
          }
          setLoading(false);
        });
    } else {
      setRelatedFields([]);
    }
  }, [fieldMappingItem.selectedReferenceTo, org]);

  const relatedObjects = useMemo(
    () =>
      orderValues(fieldMappingItem.fieldMetadata?.referenceTo || []).map(
        (item): ListItem => ({
          id: item,
          label: item,
          value: item,
        }),
      ),
    [fieldMappingItem.fieldMetadata],
  );

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
      relationshipName: fieldMappingItem.fieldMetadata?.relationshipName,
    };

    if (newFieldMappingItem.targetLookupField && newFieldMappingItem.relatedFieldMetadata?.isExternalId) {
      newFieldMappingItem.lookupOptionNullIfNoMatch = false;
      newFieldMappingItem.lookupOptionUseFirstMatch = 'ERROR_IF_MULTIPLE';
    }

    onSelectionChanged(csvField, newFieldMappingItem);
  }

  return (
    <Fragment>
      <Grid>
        <div className="slds-m-right_small">
          <ComboboxWithItems
            comboboxProps={{
              label: 'Related Object',
              isRequired: true,
              labelHelp:
                (fieldMappingItem.fieldMetadata?.referenceTo?.length || 0) <= 1
                  ? 'This option is only enabled for fields that have more than one related object.'
                  : 'This lookup can point to multiple objects, choose the related object that you are mapping to.',
              itemLength: 10,
              disabled: !!fieldMappingItem.selectedReferenceTo && (fieldMappingItem.fieldMetadata?.referenceTo?.length || 0) <= 1,
            }}
            items={relatedObjects}
            selectedItemId={fieldMappingItem.selectedReferenceTo}
            onSelected={(item) => handleRelatedObjectSelectionChanged(item.id)}
          />
        </div>
        <div className="slds-grow">
          <ComboboxWithItems
            comboboxProps={{
              label: 'Related Mappable Fields',
              errorMessage: 'A related field must be selected',
              hasError: !fieldMappingItem.relatedFieldMetadata,
              loading,
            }}
            items={relatedFields}
            selectedItemId={fieldMappingItem.targetLookupField}
            selectedItemLabelFn={getComboboxFieldName}
            onSelected={(item) => handleRelatedSelectionChanged(item.meta)}
          />
        </div>
      </Grid>
      {fieldMappingItem.targetLookupField && (
        <LoadRecordsFieldMappingRowLookupOption
          csvField={csvField}
          fieldMappingItem={fieldMappingItem}
          disabled={!!fieldMappingItem.relatedFieldMetadata?.isExternalId && fieldMappingItem.relationshipName !== SELF_LOOKUP_KEY}
          onSelectionChanged={(csvField, fieldMappingItem) => onSelectionChanged(csvField, fieldMappingItem as FieldMappingItemCsv)}
        />
      )}
    </Fragment>
  );
};
