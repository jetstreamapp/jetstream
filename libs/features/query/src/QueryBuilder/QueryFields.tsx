import { logger } from '@jetstream/shared/client-logger';
import { fetchFields, getFieldKey, getListItemsFromFieldWithRelatedItems, sortQueryFields } from '@jetstream/shared/ui-utils';
import { multiWordObjectFilter } from '@jetstream/shared/utils';
import { FieldWrapper, Maybe, QueryFieldWithPolymorphic, QueryFields } from '@jetstream/types';
import { AutoFullHeightContainer, SobjectFieldList } from '@jetstream/ui';
import { applicationCookieState, fromQueryState, selectedOrgState } from '@jetstream/ui-core';
import isEmpty from 'lodash/isEmpty';
import { Fragment, FunctionComponent, useCallback, useEffect, useRef, useState } from 'react';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import {
  getQueryFieldBaseKey,
  getQueryFieldKey,
  getSelectedFieldsFromQueryFields,
  initQueryFieldStateItem,
} from '../utils/query-fields-utils';

export interface QueryFieldsProps {
  selectedSObject: Maybe<string>;
  isTooling: boolean;
  onSelectionChanged: (fields: QueryFieldWithPolymorphic[]) => void;
}

export const QueryFieldsComponent: FunctionComponent<QueryFieldsProps> = ({ selectedSObject, isTooling, onSelectionChanged }) => {
  const [{ serverUrl }] = useRecoilState(applicationCookieState);
  const isMounted = useRef(true);
  const _selectedSObject = useRef(selectedSObject);
  const [queryFieldsMap, setQueryFieldsMap] = useRecoilState(fromQueryState.queryFieldsMapState);
  const [queryFieldsKey, setQueryFieldsKey] = useRecoilState(fromQueryState.queryFieldsKey);
  const setFilterFields = useSetRecoilState(fromQueryState.filterQueryFieldsState);
  const setOrderByFields = useSetRecoilState(fromQueryState.orderByQueryFieldsState);
  const setGroupByFields = useSetRecoilState(fromQueryState.groupByQueryFieldsState);
  const setChildRelationships = useSetRecoilState(fromQueryState.queryChildRelationships);
  const [baseKey, setBaseKey] = useState<string>(`${selectedSObject}|`);
  const selectedOrg = useRecoilValue(selectedOrgState);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  useEffect(() => {
    _selectedSObject.current = selectedSObject;
  }, [selectedSObject]);

  // Fetch fields for base object if the selected object changes
  useEffect(() => {
    if (!selectedSObject) {
      return;
    }
    const fieldKey = getQueryFieldKey(selectedOrg, selectedSObject);
    if (isEmpty(queryFieldsMap) || fieldKey !== queryFieldsKey) {
      // init query fields when object changes
      let tempQueryFieldsMap: Record<string, QueryFields> = {};
      setQueryFieldsMap(tempQueryFieldsMap);
      if (selectedSObject) {
        const BASE_KEY = getQueryFieldBaseKey(selectedSObject);
        setBaseKey(BASE_KEY);
        tempQueryFieldsMap = { ...tempQueryFieldsMap };
        tempQueryFieldsMap[BASE_KEY] = initQueryFieldStateItem(BASE_KEY, selectedSObject, { loading: true });
        setChildRelationships([]);
        setQueryFieldsMap(tempQueryFieldsMap);
        setQueryFieldsKey(fieldKey);

        queryBaseFields(fieldKey, BASE_KEY, tempQueryFieldsMap);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg, selectedSObject, isTooling]);

  const queryBaseFields = useCallback(
    async (fieldKey: string, BASE_KEY: string, tempQueryFieldsMap: Record<string, QueryFields>) => {
      tempQueryFieldsMap = { ...tempQueryFieldsMap };
      try {
        tempQueryFieldsMap[BASE_KEY] = await fetchFields(selectedOrg, tempQueryFieldsMap[BASE_KEY], BASE_KEY, isTooling);
        if (isMounted.current) {
          // set filter fields and order by fields
          const fields = Object.values(tempQueryFieldsMap[BASE_KEY].fields).map((item) => item.metadata);
          setFilterFields(getListItemsFromFieldWithRelatedItems(sortQueryFields(fields.filter((field) => field.filterable))));
          setOrderByFields(getListItemsFromFieldWithRelatedItems(sortQueryFields(fields.filter((field) => field.sortable))));
          setGroupByFields(getListItemsFromFieldWithRelatedItems(sortQueryFields(fields.filter((field) => field.groupable))));

          tempQueryFieldsMap[BASE_KEY] = { ...tempQueryFieldsMap[BASE_KEY], loading: false };
          setChildRelationships(tempQueryFieldsMap[BASE_KEY].childRelationships || []);
          if (tempQueryFieldsMap[BASE_KEY].fields.Id) {
            tempQueryFieldsMap[BASE_KEY].selectedFields.add('Id');
            emitSelectedFieldsChanged(tempQueryFieldsMap);
          }
        }
      } catch (ex) {
        logger.warn('Query SObject error', ex);
        tempQueryFieldsMap[BASE_KEY] = { ...tempQueryFieldsMap[BASE_KEY], loading: false, hasError: true };
      } finally {
        if (isMounted.current) {
          setQueryFieldsMap(tempQueryFieldsMap);
          setQueryFieldsKey(fieldKey);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedOrg, isTooling]
  );

  const queryRelatedFields = useCallback(
    async (fieldKey: string, tempQueryFieldsMap: Record<string, QueryFields>) => {
      try {
        tempQueryFieldsMap[fieldKey] = await fetchFields(selectedOrg, tempQueryFieldsMap[fieldKey], fieldKey, isTooling);
        if (isMounted.current) {
          // ensure selected object did not change
          if (tempQueryFieldsMap[fieldKey]) {
            tempQueryFieldsMap[fieldKey] = { ...tempQueryFieldsMap[fieldKey], loading: false };
            setQueryFieldsMap(tempQueryFieldsMap);
          }
        }
      } catch (ex) {
        logger.warn('Query SObject error', ex);
        tempQueryFieldsMap = { ...tempQueryFieldsMap, [fieldKey]: { ...tempQueryFieldsMap[fieldKey], loading: false, hasError: true } };
      } finally {
        if (isMounted.current) {
          setQueryFieldsMap(tempQueryFieldsMap);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedOrg, isTooling]
  );

  function emitSelectedFieldsChanged(fieldsMap: Record<string, QueryFields> = queryFieldsMap) {
    const fields: QueryFieldWithPolymorphic[] = getSelectedFieldsFromQueryFields(fieldsMap);

    onSelectionChanged(fields);
  }

  async function handleToggleFieldExpand(parentKey: string, field: FieldWrapper, relatedSobject: string) {
    const key = getFieldKey(parentKey, field.metadata);
    // if field is already initialized
    const tempQueryFieldsMap = { ...queryFieldsMap };
    if (tempQueryFieldsMap[key] && tempQueryFieldsMap[key].sobject === relatedSobject) {
      tempQueryFieldsMap[key] = { ...tempQueryFieldsMap[key], expanded: !tempQueryFieldsMap[key].expanded };
    } else {
      // this is a new expansion that we have not seen, we need to fetch the fields and init the object
      tempQueryFieldsMap[key] = initQueryFieldStateItem(key, relatedSobject, {
        loading: true,
        isPolymorphic: Array.isArray(field.relatedSobject),
      });
      // fetch fields and update once resolved
      queryRelatedFields(key, tempQueryFieldsMap);
    }
    setQueryFieldsMap({ ...tempQueryFieldsMap });
  }

  async function handleErrorReattempt(key: string) {
    const tempQueryFieldsMap = { ...queryFieldsMap };
    tempQueryFieldsMap[key] = { ...tempQueryFieldsMap[key], loading: true, hasError: false };
    setQueryFieldsMap({ ...tempQueryFieldsMap });

    queryRelatedFields(key, tempQueryFieldsMap);
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
                  !!field.relationshipKey && queryFieldsMap[field.relationshipKey] && queryFieldsMap[field.relationshipKey].expanded
              )
            )
            .map((field) => field.name)
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
