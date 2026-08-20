import { logger } from '@jetstream/shared/client-logger';
import { fetchFields, getFieldKey, sortQueryFieldsStr } from '@jetstream/shared/ui-utils';
import { multiWordObjectFilter } from '@jetstream/shared/utils';
import { FieldWrapper, QueryFieldWithPolymorphic, QueryFields, SalesforceOrgUi } from '@jetstream/types';
import { SobjectFieldList } from '@jetstream/ui';
import { fromQueryState } from '@jetstream/ui-core';
import { getSubqueryFieldBaseKey, initQueryFieldStateItem, removeInFlightQueryFields } from '@jetstream/ui-core/shared';
import { selectedOrgState } from '@jetstream/ui/app-state';
import { useAtom, useAtomValue } from 'jotai';
import isEmpty from 'lodash/isEmpty';
import { Fragment, FunctionComponent, useEffect } from 'react';

export interface QueryChildFieldsProps {
  org: SalesforceOrgUi;
  serverUrl: string;
  isTooling: boolean;
  selectedSObject: string;
  /** Relationship path from the root object, e.x. `Contacts` or `Contacts.Cases` */
  relationshipPath: string;
  onSelectionChanged: (fields: QueryFieldWithPolymorphic[]) => void;
}

export const QueryChildFields: FunctionComponent<QueryChildFieldsProps> = ({
  org,
  serverUrl,
  isTooling,
  selectedSObject,
  relationshipPath,
  onSelectionChanged,
}) => {
  const [queryFieldsMap, setQueryFieldsMap] = useAtom(fromQueryState.queryFieldsMapState);
  const selectedOrg = useAtomValue(selectedOrgState);
  const baseKey = getSubqueryFieldBaseKey(selectedSObject, relationshipPath);

  // Fetch fields for base object if the selected object changes
  useEffect(() => {
    const BASE_KEY = getSubqueryFieldBaseKey(selectedSObject, relationshipPath);
    let abandoned = false;

    if (isEmpty(queryFieldsMap[BASE_KEY])) {
      const baseFieldsPlaceholder = initQueryFieldStateItem(BASE_KEY, selectedSObject, { loading: true });
      // set to loading state while base fields are fetched
      setQueryFieldsMap((priorFieldsMap) => ({ ...priorFieldsMap, [BASE_KEY]: baseFieldsPlaceholder }));
      (async () => {
        let baseQueryFields: QueryFields;
        try {
          baseQueryFields = { ...(await fetchFields(selectedOrg, baseFieldsPlaceholder, BASE_KEY, isTooling)), loading: false };
        } catch (ex) {
          logger.warn('[SUBQUERY] Query SObject error', ex);
          baseQueryFields = { ...baseFieldsPlaceholder, loading: false, hasError: true };
        }
        if (abandoned) {
          return;
        }
        setQueryFieldsMap((priorFieldsMap) => ({ ...priorFieldsMap, [BASE_KEY]: baseQueryFields }));
      })();
    }

    return () => {
      abandoned = true;
      // Drop the placeholders for any fetch that will never write its result, otherwise the guards
      // above and in handleToggleFieldExpand treat them as loaded and the spinner never clears
      setQueryFieldsMap((priorFieldsMap) => removeInFlightQueryFields(priorFieldsMap, BASE_KEY));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg, selectedSObject, relationshipPath, isTooling]);

  async function fetchRelatedFields(key: string, relatedFieldsPlaceholder: QueryFields) {
    let relatedQueryFields: QueryFields;
    try {
      relatedQueryFields = { ...(await fetchFields(selectedOrg, relatedFieldsPlaceholder, key, isTooling)), loading: false };
    } catch (ex) {
      logger.warn('Query SObject error', ex);
      relatedQueryFields = { ...relatedFieldsPlaceholder, loading: false, hasError: true };
    }
    // Replace only this key - sibling expansions may have resolved while this fetch was in flight
    setQueryFieldsMap((priorFieldsMap) => (priorFieldsMap[key] ? { ...priorFieldsMap, [key]: relatedQueryFields } : priorFieldsMap));
  }

  /**
   * FIXME: This is rather complicated to follow the code path
   * We have a key for all objects and this finds all the keys related to the current object
   * and gets the selected fields
   * There is a little too much hard-coded magic here...
   * @param fieldsMap
   */
  function emitSelectedFieldsChanged(fieldsMap: Record<string, QueryFields> = queryFieldsMap) {
    const fields: QueryFieldWithPolymorphic[] = Object.values(fieldsMap)
      .filter((queryField) => queryField.key.startsWith(baseKey))
      .flatMap((queryField) => {
        // remove the first part of the key (which identified this object)
        const basePath = queryField.key.replace(/.+\|/, '');
        return sortQueryFieldsStr(Array.from(queryField.selectedFields)).map((field): QueryFieldWithPolymorphic => ({
          field: `${basePath}${field}`,
          polymorphicObj: queryField.isPolymorphic ? queryField.sobject : undefined,
          metadata: queryField.fields[field]?.metadata,
        }));
      });

    onSelectionChanged(fields);
  }

  function handleToggleFieldExpand(parentKey: string, field: FieldWrapper, relatedSobject: string) {
    // FIXME: should be centralized:
    // const key = `${parentKey}${field.metadata.relationshipName}.`;
    const key = getFieldKey(parentKey, field.metadata);
    const existingFields = queryFieldsMap[key];
    // if field is already initialized
    if (existingFields) {
      // Toggle against the published map rather than this render's snapshot - a sibling fetch may
      // have resolved into it since, and rewriting the snapshot would undo that
      setQueryFieldsMap((priorFieldsMap) => {
        const currentFields = priorFieldsMap[key] || existingFields;
        return { ...priorFieldsMap, [key]: { ...currentFields, expanded: !currentFields.expanded } };
      });
      return;
    }
    // this is a new expansion that we have not seen, we need to fetch the fields and init the object
    const relatedFieldsPlaceholder = initQueryFieldStateItem(key, relatedSobject, {
      loading: true,
      isPolymorphic: Array.isArray(field.relatedSobject),
    });
    setQueryFieldsMap((priorFieldsMap) => ({ ...priorFieldsMap, [key]: relatedFieldsPlaceholder }));
    // fetch fields and update once resolved
    fetchRelatedFields(key, relatedFieldsPlaceholder);
  }

  function handleErrorReattempt(key: string) {
    if (!queryFieldsMap[key]) {
      return;
    }
    const relatedFieldsPlaceholder = { ...queryFieldsMap[key], loading: true, hasError: false };
    setQueryFieldsMap((priorFieldsMap) => ({ ...priorFieldsMap, [key]: relatedFieldsPlaceholder }));

    fetchRelatedFields(key, relatedFieldsPlaceholder);
  }

  function handleFieldSelection(key: string, field: FieldWrapper) {
    if (queryFieldsMap[key]) {
      const clonedFieldsMapItem = queryFieldsMap[key];
      if (clonedFieldsMapItem.selectedFields.has(field.name)) {
        clonedFieldsMapItem.selectedFields.delete(field.name);
      } else {
        clonedFieldsMapItem.selectedFields.add(field.name);
      }
      setQueryFieldsMap({
        ...queryFieldsMap,
        [key]: { ...clonedFieldsMapItem, selectedFields: new Set(clonedFieldsMapItem.selectedFields) },
      });
      emitSelectedFieldsChanged(queryFieldsMap);
    }
  }

  function handleFieldSelectAll(key: string, value: boolean) {
    if (queryFieldsMap[key]) {
      const clonedQueryFieldsMap = { ...queryFieldsMap };
      if (value) {
        clonedQueryFieldsMap[key] = { ...clonedQueryFieldsMap[key], selectedFields: new Set(clonedQueryFieldsMap[key].visibleFields) };
      } else {
        // remove visible fields from list (this could be all or only some of the fields)
        const selectedFields = new Set(clonedQueryFieldsMap[key].selectedFields);
        clonedQueryFieldsMap[key].visibleFields.forEach((field) => selectedFields.delete(field));
        clonedQueryFieldsMap[key] = { ...clonedQueryFieldsMap[key], selectedFields };
      }
      setQueryFieldsMap(clonedQueryFieldsMap);
      emitSelectedFieldsChanged(clonedQueryFieldsMap);
    }
  }

  function handleFieldFilterChanged(key: string, filterTerm: string) {
    if (queryFieldsMap[key] && queryFieldsMap[key].filterTerm !== filterTerm) {
      const clonedQueryFieldsMap = { ...queryFieldsMap };
      const tempQueryField: QueryFields = { ...clonedQueryFieldsMap[key], filterTerm: filterTerm || '' };
      filterTerm = (filterTerm || '').toLocaleLowerCase();
      if (!filterTerm) {
        tempQueryField.visibleFields = new Set(Object.keys(tempQueryField.fields));
      } else {
        tempQueryField.visibleFields = new Set(
          Object.values(tempQueryField.fields)
            .filter(
              multiWordObjectFilter(
                ['filterText'],
                filterTerm,
                (field) =>
                  !!field.relationshipKey && queryFieldsMap[field.relationshipKey] && queryFieldsMap[field.relationshipKey].expanded,
              ),
            )
            .map((field) => field.name),
        );
      }
      clonedQueryFieldsMap[key] = tempQueryField;
      setQueryFieldsMap(clonedQueryFieldsMap);
    }
  }

  /**
   * Only clear fields belonging to this subquery - the fields map holds the base object and every other
   * subquery too, and only this subquery's selection is emitted back to the builder.
   */
  function handleOnUnselectAll() {
    const clonedQueryFieldsMap = { ...queryFieldsMap };
    Object.keys(clonedQueryFieldsMap)
      .filter((key) => key.startsWith(baseKey))
      .forEach((key) => {
        clonedQueryFieldsMap[key] = { ...clonedQueryFieldsMap[key], selectedFields: new Set() };
      });
    setQueryFieldsMap(clonedQueryFieldsMap);
    emitSelectedFieldsChanged(clonedQueryFieldsMap);
  }

  return (
    // eslint-disable-next-line react/jsx-no-useless-fragment
    <Fragment>
      {selectedSObject && queryFieldsMap[baseKey] && (
        <SobjectFieldList
          org={org}
          serverUrl={serverUrl}
          isTooling={isTooling}
          level={0}
          itemKey={baseKey}
          queryFieldsMap={queryFieldsMap}
          sobject={selectedSObject}
          errorReattempt={handleErrorReattempt}
          onToggleExpand={handleToggleFieldExpand}
          onSelectField={handleFieldSelection}
          onSelectAll={handleFieldSelectAll}
          onFilterChanged={handleFieldFilterChanged}
          onUnselectAll={handleOnUnselectAll}
        />
      )}
    </Fragment>
  );
};

export default QueryChildFields;
