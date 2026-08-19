import { logger } from '@jetstream/shared/client-logger';
import { fetchFields, getFieldKey, getListItemsFromFieldWithRelatedItems, sortQueryFields } from '@jetstream/shared/ui-utils';
import { multiWordObjectFilter } from '@jetstream/shared/utils';
import { FieldWrapper, Maybe, QueryFieldWithPolymorphic, QueryFields } from '@jetstream/types';
import { AutoFullHeightContainer, SobjectFieldList } from '@jetstream/ui';
import { fromQueryState } from '@jetstream/ui-core';
import {
  getQueryFieldBaseKey,
  getQueryFieldKey,
  getSelectedFieldsFromQueryFields,
  initQueryFieldStateItem,
  removeInFlightQueryFields,
} from '@jetstream/ui-core/shared';
import { applicationCookieState, selectedOrgState } from '@jetstream/ui/app-state';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import isEmpty from 'lodash/isEmpty';
import { Fragment, FunctionComponent, useCallback, useEffect, useRef } from 'react';

export interface QueryFieldsProps {
  selectedSObject: Maybe<string>;
  isTooling: boolean;
  onSelectionChanged: (fields: QueryFieldWithPolymorphic[]) => void;
}

export const QueryFieldsComponent: FunctionComponent<QueryFieldsProps> = ({ selectedSObject, isTooling, onSelectionChanged }) => {
  const [{ serverUrl }] = useAtom(applicationCookieState);
  const isMounted = useRef(true);
  const [queryFieldsMap, setQueryFieldsMap] = useAtom(fromQueryState.queryFieldsMapState);
  const [queryFieldsKey, setQueryFieldsKey] = useAtom(fromQueryState.queryFieldsKey);
  const setFilterFields = useSetAtom(fromQueryState.filterQueryFieldsState);
  const setOrderByFields = useSetAtom(fromQueryState.orderByQueryFieldsState);
  const setGroupByFields = useSetAtom(fromQueryState.groupByQueryFieldsState);
  const setChildRelationships = useSetAtom(fromQueryState.queryChildRelationships);
  const selectedOrg = useAtomValue(selectedOrgState);
  const baseKey = selectedSObject ? getQueryFieldBaseKey(selectedSObject) : '';

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const queryBaseFields = useCallback(
    async (fieldKey: string, baseFieldKey: string, sobject: string, isAbandoned: () => boolean) => {
      let baseQueryFields = initQueryFieldStateItem(baseFieldKey, sobject, { loading: true });
      try {
        baseQueryFields = { ...(await fetchFields(selectedOrg, baseQueryFields, baseFieldKey, isTooling)), loading: false };
      } catch (ex) {
        logger.warn('Query SObject error', ex);
        baseQueryFields = { ...baseQueryFields, loading: false, hasError: true };
      }

      // A newer org/object was selected, or the component went away, while this fetch was in flight.
      // Writing now would replace the current object's fields with fields nobody asked for.
      if (isAbandoned()) {
        return;
      }

      if (!baseQueryFields.hasError) {
        // set filter fields and order by fields
        const fields = Object.values(baseQueryFields.fields).map(({ metadata }) => metadata);
        setFilterFields(getListItemsFromFieldWithRelatedItems(sortQueryFields(fields.filter((field) => field.filterable))));
        setOrderByFields(getListItemsFromFieldWithRelatedItems(sortQueryFields(fields.filter((field) => field.sortable))));
        setGroupByFields(
          getListItemsFromFieldWithRelatedItems(sortQueryFields(fields.filter((field) => field.groupable || field.type === 'datetime'))),
        );
        setChildRelationships(baseQueryFields.childRelationships || []);
        if (baseQueryFields.fields.Id) {
          baseQueryFields.selectedFields.add('Id');
        }
      }

      const updatedQueryFieldsMap = { [baseFieldKey]: baseQueryFields };
      setQueryFieldsMap(updatedQueryFieldsMap);
      // Only claim the key once the fields behind it actually landed, otherwise an abandoned fetch
      // leaves the key pointing at fields that were never loaded
      setQueryFieldsKey(fieldKey);
      if (baseQueryFields.fields.Id) {
        emitSelectedFieldsChanged(updatedQueryFieldsMap);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedOrg, isTooling],
  );

  // Fetch fields for base object if the selected object changes
  useEffect(() => {
    if (!selectedSObject) {
      return;
    }
    const BASE_KEY = getQueryFieldBaseKey(selectedSObject);
    const fieldKey = getQueryFieldKey(selectedOrg, selectedSObject);
    let abandoned = false;

    // Anything already in the map under this exact org + object was loaded (or restored) previously
    if (fieldKey !== queryFieldsKey || isEmpty(queryFieldsMap[BASE_KEY])) {
      setChildRelationships([]);
      setQueryFieldsMap({ [BASE_KEY]: initQueryFieldStateItem(BASE_KEY, selectedSObject, { loading: true }) });
      queryBaseFields(fieldKey, BASE_KEY, selectedSObject, () => abandoned);
    }

    return () => {
      abandoned = true;
      setQueryFieldsMap((priorFieldsMap) => removeInFlightQueryFields(priorFieldsMap, BASE_KEY));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg, selectedSObject, isTooling]);

  const queryRelatedFields = useCallback(
    async (fieldKey: string, relatedFieldsPlaceholder: QueryFields) => {
      let relatedQueryFields: QueryFields;
      try {
        relatedQueryFields = { ...(await fetchFields(selectedOrg, relatedFieldsPlaceholder, fieldKey, isTooling)), loading: false };
      } catch (ex) {
        logger.warn('Query SObject error', ex);
        relatedQueryFields = { ...relatedFieldsPlaceholder, loading: false, hasError: true };
      }
      if (!isMounted.current) {
        return;
      }
      // Replace only this key - sibling expansions may have resolved, and the base object may have
      // been swapped out entirely, while this fetch was in flight
      setQueryFieldsMap((priorFieldsMap) =>
        priorFieldsMap[fieldKey] ? { ...priorFieldsMap, [fieldKey]: relatedQueryFields } : priorFieldsMap,
      );
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedOrg, isTooling],
  );

  function emitSelectedFieldsChanged(fieldsMap: Record<string, QueryFields> = queryFieldsMap) {
    const fields: QueryFieldWithPolymorphic[] = getSelectedFieldsFromQueryFields(fieldsMap);

    onSelectionChanged(fields);
  }

  function handleToggleFieldExpand(parentKey: string, field: FieldWrapper, relatedSobject: string) {
    const key = getFieldKey(parentKey, field.metadata);
    const existingFields = queryFieldsMap[key];
    // if field is already initialized
    if (existingFields && existingFields.sobject === relatedSobject) {
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
    queryRelatedFields(key, relatedFieldsPlaceholder);
  }

  function handleErrorReattempt(key: string) {
    if (!queryFieldsMap[key]) {
      return;
    }
    const relatedFieldsPlaceholder = { ...queryFieldsMap[key], loading: true, hasError: false };
    setQueryFieldsMap((priorFieldsMap) => ({ ...priorFieldsMap, [key]: relatedFieldsPlaceholder }));

    queryRelatedFields(key, relatedFieldsPlaceholder);
  }

  function handleFieldSelection(key: string, field: FieldWrapper) {
    if (queryFieldsMap[key]) {
      const clonedFieldsMapItem = queryFieldsMap[key];
      if (clonedFieldsMapItem.selectedFields.has(field.name)) {
        clonedFieldsMapItem.selectedFields.delete(field.name);
      } else {
        clonedFieldsMapItem.selectedFields.add(field.name);
      }
      setQueryFieldsMap(queryFieldsMap);
      emitSelectedFieldsChanged(queryFieldsMap);
    }
  }

  /**
   * @param key sobject key
   * @param value select all = true/false
   * @param impactedKeys children may have filtered data locally, so keys are passed in to specify the specific fields
   */
  function handleFieldSelectAll(key: string, value: boolean, impactedKeys: string[]) {
    if (queryFieldsMap[key]) {
      const clonedQueryFieldsMap = { ...queryFieldsMap };
      if (value) {
        // keep existing fields and add newly selected fields
        clonedQueryFieldsMap[key] = {
          ...clonedQueryFieldsMap[key],
          selectedFields: new Set(Array.from(clonedQueryFieldsMap[key].selectedFields).concat(impactedKeys)),
        };
      } else {
        // remove visible fields from list (this could be all or only some of the fields)
        const selectedFields = new Set(clonedQueryFieldsMap[key].selectedFields);
        impactedKeys.forEach((field) => selectedFields.delete(field));
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

  function handleOnUnselectAll() {
    const clonedQueryFieldsMap = { ...queryFieldsMap };
    Object.keys(clonedQueryFieldsMap).forEach((key) => {
      clonedQueryFieldsMap[key] = { ...clonedQueryFieldsMap[key], selectedFields: new Set() };
    });
    setQueryFieldsMap(clonedQueryFieldsMap);
    emitSelectedFieldsChanged(clonedQueryFieldsMap);
  }

  return (
    // eslint-disable-next-line react/jsx-no-useless-fragment
    <Fragment>
      {selectedSObject && queryFieldsMap[baseKey] && (
        <AutoFullHeightContainer bottomBuffer={10}>
          <SobjectFieldList
            serverUrl={serverUrl}
            org={selectedOrg}
            isTooling={isTooling}
            level={0}
            itemKey={baseKey}
            queryFieldsMap={queryFieldsMap}
            sobject={selectedSObject}
            errorReattempt={handleErrorReattempt}
            onToggleExpand={handleToggleFieldExpand}
            onSelectField={handleFieldSelection}
            onSelectAll={handleFieldSelectAll}
            onUnselectAll={handleOnUnselectAll}
            onFilterChanged={handleFieldFilterChanged}
          />
        </AutoFullHeightContainer>
      )}
    </Fragment>
  );
};

export default QueryFieldsComponent;
