import { logger } from '@jetstream/shared/client-logger';
import { fetchFields, getFieldKey, sortQueryFieldsPolymorphic } from '@jetstream/shared/ui-utils';
import { orderObjectsBy } from '@jetstream/shared/utils';
import { FieldWrapper, MapOf, QueryFields, SalesforceOrgUi, QueryFieldWithPolymorphic } from '@jetstream/types';
import { AutoFullHeightContainer, SobjectFieldList } from '@jetstream/ui';
import isEmpty from 'lodash/isEmpty';
import React, { Fragment, FunctionComponent, useEffect, useRef, useState } from 'react';
import { useRecoilState, useRecoilValue, useSetRecoilState } from 'recoil';
import { selectedOrgState } from '../../../app-state';
import * as fromQueryState from '../query.state';

// separator used on key of suquery fields - this are omitted from field selection
const CHILD_FIELD_SEPARATOR = `~`;

export interface QueryFieldsProps {
  selectedSObject: string;
  onSelectionChanged: (fields: QueryFieldWithPolymorphic[]) => void;
}

function getQueryFieldKey(selectedOrg: SalesforceOrgUi, selectedSObject: string) {
  return `${selectedOrg?.uniqueId}-${selectedSObject}`;
}

export const QueryFieldsComponent: FunctionComponent<QueryFieldsProps> = ({ selectedSObject, onSelectionChanged }) => {
  const isMounted = useRef(null);
  const [queryFieldsMap, setQueryFieldsMap] = useRecoilState(fromQueryState.queryFieldsMapState);
  const [queryFieldsKey, setQueryFieldsKey] = useRecoilState(fromQueryState.queryFieldsKey);
  const setChildRelationships = useSetRecoilState(fromQueryState.queryChildRelationships);
  const [baseKey, setBaseKey] = useState<string>(`${selectedSObject}|`);
  const selectedOrg = useRecoilValue(selectedOrgState);

  useEffect(() => {
    isMounted.current = true;
    return () => (isMounted.current = false);
  }, []);

  // Fetch fields for base object if the selected object changes
  useEffect(() => {
    const fieldKey = getQueryFieldKey(selectedOrg, selectedSObject);
    if (isEmpty(queryFieldsMap) || fieldKey !== queryFieldsKey) {
      // init query fields when object changes
      let tempQueryFieldsMap: MapOf<QueryFields> = {};
      setQueryFieldsMap(tempQueryFieldsMap);
      if (selectedSObject) {
        const BASE_KEY = `${selectedSObject}|`;
        setBaseKey(BASE_KEY);
        tempQueryFieldsMap = { ...tempQueryFieldsMap };
        tempQueryFieldsMap[BASE_KEY] = {
          key: BASE_KEY,
          expanded: true,
          loading: true,
          isPolymorphic: false,
          hasError: false,
          filterTerm: '',
          sobject: selectedSObject,
          fields: {},
          visibleFields: new Set(),
          selectedFields: new Set(),
        };
        setChildRelationships([]);
        setQueryFieldsMap(tempQueryFieldsMap);
        setQueryFieldsKey(fieldKey);
        (async () => {
          tempQueryFieldsMap = { ...tempQueryFieldsMap };
          try {
            tempQueryFieldsMap[BASE_KEY] = await fetchFields(selectedOrg, tempQueryFieldsMap[BASE_KEY], BASE_KEY);
            if (isMounted) {
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
            if (isMounted) {
              setQueryFieldsMap(tempQueryFieldsMap);
              setQueryFieldsKey(fieldKey);
            }
          }
        })();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg, selectedSObject]);

  function emitSelectedFieldsChanged(fieldsMap: MapOf<QueryFields> = queryFieldsMap) {
    // const fields: QueryFieldWithPolymorphic[] = Object.values(fieldsMap)
    //   .filter((queryField) => !queryField.key.includes(CHILD_FIELD_SEPARATOR))
    //   .flatMap((queryField) => {
    //     const basePath = queryField.key.replace(/.+\|/, '');
    //     return sortQueryFieldsStr(Array.from(queryField.selectedFields))
    //       .map((fieldKey) => `${basePath}${fieldKey}`)
    //       .map((field) => ({ field, polymorphicObj: queryField.isPolymorphic ? queryField.sobject : undefined }));
    //   });

    // const fields = sortQueryFieldsStr(
    //   orderStringsBy(
    //     Object.values(fieldsMap)
    //       .filter((queryField) => !queryField.key.includes(CHILD_FIELD_SEPARATOR))
    //       .flatMap((queryField) => {
    //         const basePath = queryField.key.replace(/.+\|/, '');
    //         return Array.from(queryField.selectedFields).map((fieldKey) => `${basePath}${fieldKey}`);
    //       })
    //   )
    // );
    const fields: QueryFieldWithPolymorphic[] = sortQueryFieldsPolymorphic(
      orderObjectsBy(
        Object.values(fieldsMap)
          .filter((queryField) => !queryField.key.includes(CHILD_FIELD_SEPARATOR))
          .flatMap((queryField) => {
            const basePath = queryField.key.replace(/.+\|/, '');
            return Array.from(queryField.selectedFields)
              .map((fieldKey) => `${basePath}${fieldKey}`)
              .map((field) => ({ field, polymorphicObj: queryField.isPolymorphic ? queryField.sobject : undefined }));
          }),
        'field'
      )
    );

    onSelectionChanged(fields);
  }

  async function handleToggleFieldExpand(parentKey: string, field: FieldWrapper, relatedSobject: string) {
    const key = getFieldKey(parentKey, field.metadata);
    // if field is already initialized
    const clonedQueryFieldsMap = { ...queryFieldsMap };
    if (clonedQueryFieldsMap[key] && clonedQueryFieldsMap[key].sobject === relatedSobject) {
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
          clonedQueryFieldsMap[key] = await fetchFields(selectedOrg, clonedQueryFieldsMap[key], key);
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
      clonedQueryFieldsMap[key] = await fetchFields(selectedOrg, clonedQueryFieldsMap[key], key);
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
      filterTerm = (filterTerm || '').toLocaleLowerCase();
      if (!filterTerm) {
        tempQueryField.visibleFields = new Set(Object.keys(tempQueryField.fields));
      } else {
        tempQueryField.visibleFields = new Set(
          Object.values(tempQueryField.fields)
            .filter(
              (field) =>
                field.filterText.includes(filterTerm) ||
                (!!field.relationshipKey && queryFieldsMap[field.relationshipKey] && queryFieldsMap[field.relationshipKey].expanded)
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
    <Fragment>
      {selectedSObject && queryFieldsMap[baseKey] && (
        <AutoFullHeightContainer bottomBuffer={25}>
          <SobjectFieldList
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
