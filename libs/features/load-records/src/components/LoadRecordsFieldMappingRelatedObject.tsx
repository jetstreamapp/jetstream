import { logger } from '@jetstream/shared/client-logger';
import { orderValues } from '@jetstream/shared/utils';
import { FieldMappingItem, FieldMappingItemCsv, FieldRelatedEntity, ListItem, SalesforceOrgUi } from '@jetstream/types';
import { ComboboxWithItems, Grid, Icon, Tooltip } from '@jetstream/ui';
import { fetchRelatedFields, SELF_LOOKUP_KEY } from '@jetstream/ui-core';
import { Fragment, FunctionComponent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const [loadingError, setLoadingError] = useState(false);
  const currentFetchRequest = useRef(0);

  const fetchData = useCallback(
    async (skipCache = false) => {
      if (!fieldMappingItem.selectedReferenceTo) {
        setRelatedFields([]);
        return;
      }
      const currRequest = ++currentFetchRequest.current;
      try {
        setLoading(true);
        setLoadingError(false);
        const fields = await fetchRelatedFields(org, fieldMappingItem.selectedReferenceTo, skipCache);
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
      } catch (ex) {
        if (currRequest === currentFetchRequest.current) {
          logger.error('Error fetching related fields', ex);
          setLoadingError(true);
        }
      } finally {
        if (currRequest === currentFetchRequest.current) {
          setLoading(false);
        }
      }
    },
    [fieldMappingItem.selectedReferenceTo, org],
  );

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
        <Grid className="slds-grow">
          <ComboboxWithItems
            comboboxProps={{
              className: 'w-100',
              label: 'Related Mappable Fields',
              errorMessage: loadingError
                ? 'There was a problem loading related fields for this object'
                : 'A related field must be selected',
              hasError: loadingError || !fieldMappingItem.relatedFieldMetadata,
              loading,
            }}
            items={relatedFields}
            selectedItemId={fieldMappingItem.targetLookupField}
            selectedItemLabelFn={getComboboxFieldName}
            onSelected={(item) => handleRelatedSelectionChanged(item.meta)}
          />
          <Tooltip content="Reload related record fields">
            <button
              className="slds-button slds-button_icon slds-m-left_x-small slds-m-top_x-large"
              disabled={loading}
              onClick={() => fetchData(true)}
            >
              <Icon type="utility" icon="refresh" className="slds-button__icon slds-button__icon_small" omitContainer />
              <span className="slds-assistive-text">Reload related record fields</span>
            </button>
          </Tooltip>
        </Grid>
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
