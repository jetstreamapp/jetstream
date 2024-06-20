import { logger } from '@jetstream/shared/client-logger';
import { fetchFields, getFieldKey, sortQueryFieldsStr } from '@jetstream/shared/ui-utils';
import { multiWordObjectFilter } from '@jetstream/shared/utils';
import { FieldWrapper, QueryFieldWithPolymorphic, QueryFields, SalesforceOrgUi } from '@jetstream/types';
import { SobjectFieldList } from '@jetstream/ui';
import { fromQueryState, selectedOrgState } from '@jetstream/ui-core';
import isEmpty from 'lodash/isEmpty';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { getSubqueryFieldBaseKey } from '../utils/query-fields-utils';

export interface QueryChildFieldsProps {
  org: SalesforceOrgUi;
  serverUrl: string;
  isTooling: boolean;
  selectedSObject: string;
  parentRelationshipName: string;
  onSelectionChanged: (fields: QueryFieldWithPolymorphic[]) => void;
}

export const QueryChildFields: FunctionComponent<QueryChildFieldsProps> = ({
  org,
  serverUrl,
  isTooling,
  selectedSObject,
  parentRelationshipName,
  onSelectionChanged,
}) => {
  const [queryFieldsMap, setQueryFieldsMap] = useRecoilState(fromQueryState.queryFieldsMapState);
  const [baseKey, setBaseKey] = useState<string>(getSubqueryFieldBaseKey(selectedSObject, parentRelationshipName));
  const selectedOrg = useRecoilValue(selectedOrgState);

  // Fetch fields for base object if the selected object changes
  useEffect(() => {
    const BASE_KEY = getSubqueryFieldBaseKey(selectedSObject, parentRelationshipName);

    let baseQueryFieldsMap: QueryFields = queryFieldsMap[BASE_KEY];

    if (isEmpty(baseQueryFieldsMap)) {
      setBaseKey(BASE_KEY);
      // clone so we can mutate
      let tempQueryFieldsMap = { ...queryFieldsMap };
      // clone so we can mutate
      baseQueryFieldsMap = { ...baseQueryFieldsMap };
      baseQueryFieldsMap = {
        key: BASE_KEY,
        isPolymorphic: false,
        expanded: true,
        loading: true,
        hasError: false,
        filterTerm: '',
        sobject: selectedSObject,
        fields: {},
        visibleFields: new Set(),
        selectedFields: new Set(),
      };
      // set to loading state while base fields are fetched
      tempQueryFieldsMap[BASE_KEY] = baseQueryFieldsMap;
      setQueryFieldsMap(tempQueryFieldsMap);
      (async () => {
        tempQueryFieldsMap = { ...queryFieldsMap };
        baseQueryFieldsMap = { ...baseQueryFieldsMap };
        try {
          // fetch fields
          baseQueryFieldsMap = await fetchFields(selectedOrg, baseQueryFieldsMap, BASE_KEY, isTooling);
          // clone and set to loading
          baseQueryFieldsMap = { ...baseQueryFieldsMap, loading: false };
          // update object on core state
          tempQueryFieldsMap[BASE_KEY] = baseQueryFieldsMap;
        } catch (ex) {
          logger.warn('[SUBQUERY] Query SObject error', ex);
          baseQueryFieldsMap = { ...baseQueryFieldsMap, loading: false, hasError: true };
          tempQueryFieldsMap[BASE_KEY] = baseQueryFieldsMap;
        } finally {
          setQueryFieldsMap(tempQueryFieldsMap);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg, selectedSObject]);

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
        return sortQueryFieldsStr(Array.from(queryField.selectedFields)).map(
          (field): QueryFieldWithPolymorphic => ({
            field: `${basePath}${field}`,
            polymorphicObj: queryField.isPolymorphic ? queryField.sobject : undefined,
            metadata: queryField.fields[field]?.metadata,
          })
        );
      });

    onSelectionChanged(fields);
  }

  async function handleToggleFieldExpand(parentKey: string, field: FieldWrapper, relatedSobject: string) {
    // FIXME: should be centralized:
    // const key = `${parentKey}${field.metadata.relationshipName}.`;
    const key = getFieldKey(parentKey, field.metadata);
    // if field is already initialized
    const clonedQueryFieldsMap = { ...queryFieldsMap };
    if (clonedQueryFieldsMap[key]) {
      clonedQueryFieldsMap[key] = { ...clonedQueryFieldsMap[key], expanded: !clonedQueryFieldsMap[key].expanded };
    } else {
      // this is a new expansion that we have not seen, we need to fetch the fields and init the object
      clonedQueryFieldsMap[key] = {
        key,
        expanded: true,
        loading: true,
        hasError: false,
        filterTerm: '',
        sobject: relatedSobject,
        isPolymorphic: Array.isArray(field.relatedSobject),
        fields: {},
        visibleFields: new Set(),
        selectedFields: new Set(),
      };
      // fetch fields and update once resolved
      (async () => {
        try {
          clonedQueryFieldsMap[key] = await fetchFields(selectedOrg, clonedQueryFieldsMap[key], key, isTooling);
          // ensure selected object did not change
          if (clonedQueryFieldsMap[key]) {
            clonedQueryFieldsMap[key] = { ...clonedQueryFieldsMap[key], loading: false };
            setQueryFieldsMap(clonedQueryFieldsMap);
          }
        } catch (ex) {
          logger.warn('Query SObject error', ex);
          clonedQueryFieldsMap[key] = { ...clonedQueryFieldsMap[key], loading: false, hasError: true };
        } finally {
          setQueryFieldsMap(clonedQueryFieldsMap);
        }
      })();
    }
    setQueryFieldsMap({ ...clonedQueryFieldsMap });
  }

  async function handleErrorReattempt(key: string) {
    const clonedQueryFieldsMap = { ...queryFieldsMap };
    clonedQueryFieldsMap[key] = { ...clonedQueryFieldsMap[key], loading: true, hasError: false };
    setQueryFieldsMap({ ...clonedQueryFieldsMap });

    // This is a candidate to pull into shared function
    try {
      clonedQueryFieldsMap[key] = await fetchFields(selectedOrg, clonedQueryFieldsMap[key], key, isTooling);
      // ensure selected object did not change
      if (clonedQueryFieldsMap[key]) {
        clonedQueryFieldsMap[key] = { ...clonedQueryFieldsMap[key], loading: false };
        setQueryFieldsMap(clonedQueryFieldsMap);
      }
    } catch (ex) {
      logger.warn('Query SObject error', ex);
      clonedQueryFieldsMap[key] = { ...clonedQueryFieldsMap[key], loading: false, hasError: true };
    } finally {
      setQueryFieldsMap(clonedQueryFieldsMap);
    }
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
