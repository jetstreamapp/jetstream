import { logger } from '@jetstream/shared/client-logger';
import { fetchFields, getFieldKey, sortQueryFieldsStr } from '@jetstream/shared/ui-utils';
import { FieldWrapper, MapOf, QueryFields, SalesforceOrgUi } from '@jetstream/types';
import { AutoFullHeightContainer, SobjectFieldList } from '@jetstream/ui';
import { isEmpty } from 'lodash';
import React, { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { useRecoilState, useRecoilValue } from 'recoil';
import { selectedOrgState } from '../../../app-state';
import * as fromQueryState from '../query.state';

// separator used on key of suquery fields - only fields with this key are included
const CHILD_FIELD_SEPARATOR = `~`;

export interface QueryChildFieldsProps {
  selectedSObject: string;
  parentRelationshipName: string;
  onSelectionChanged: (fields: string[]) => void;
  // onFieldsFetched: (queryFields: MapOf<QueryFields>) => void;
}

// TODO: use this same pattern with QueryFields.tsx
function getBaseKey(selectedSObject: string, parentRelationshipName: string) {
  return `${selectedSObject}~${parentRelationshipName}|`;
}

// TODO: what does this do/mean for a subquery???? isn't this just to know if results belong to same selection?
function getQueryFieldKey(selectedOrg: SalesforceOrgUi, selectedSObject: string, parentRelationshipName: string) {
  return `${selectedOrg?.uniqueId}-${selectedSObject}-${parentRelationshipName}`;
}

export const QueryChildFieldsComponent: FunctionComponent<QueryChildFieldsProps> = ({
  selectedSObject,
  parentRelationshipName,
  onSelectionChanged,
}) => {
  // TODO: this is global - the parent can clear, but we cannot!
  // we can add to this as long as our keys are unique
  const [queryFieldsMap, setQueryFieldsMap] = useRecoilState(fromQueryState.queryFieldsMapState);
  // TODO: WTF is this? and how will it destroy me?
  const [queryFieldsKey, setQueryFieldsKey] = useRecoilState(fromQueryState.queryFieldsKey);
  const [baseKey, setBaseKey] = useState<string>(getBaseKey(selectedSObject, parentRelationshipName));
  const selectedOrg = useRecoilValue(selectedOrgState);

  // Fetch fields for base object if the selected object changes
  useEffect(() => {
    const BASE_KEY = getBaseKey(selectedSObject, parentRelationshipName);
    // TODO: do I need this? do we use this for subquery? how do we handle results after obj changed?
    const fieldKey = getQueryFieldKey(selectedOrg, selectedSObject, parentRelationshipName);

    let baseQueryFieldsMap: QueryFields = queryFieldsMap[BASE_KEY];

    if (isEmpty(baseQueryFieldsMap)) {
      setBaseKey(BASE_KEY);
      // clone so we can mutate
      let tempQueryFieldsMap = { ...queryFieldsMap };
      // clone so we can mutate
      baseQueryFieldsMap = { ...baseQueryFieldsMap };
      baseQueryFieldsMap = {
        key: BASE_KEY,
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
          baseQueryFieldsMap = await fetchFields(selectedOrg, baseQueryFieldsMap, BASE_KEY);
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

  function emitSelectedFieldsChanged(fieldsMap: MapOf<QueryFields> = queryFieldsMap) {
    const fields = Object.values(fieldsMap)
      .filter((queryField) => queryField.key.includes(CHILD_FIELD_SEPARATOR))
      .flatMap((queryField) => {
        const basePath = queryField.key.replace(/.+\|/, '');
        return sortQueryFieldsStr(Array.from(queryField.selectedFields)).map((fieldKey) => `${basePath}${fieldKey}`);
      });
    onSelectionChanged(fields);
  }

  async function handleToggleFieldExpand(parentKey: string, field: FieldWrapper) {
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
        sobject: field.relatedSobject as string,
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

  return (
    <Fragment>
      {selectedSObject && queryFieldsMap[baseKey] && (
        <AutoFullHeightContainer fillHeight={!parentRelationshipName}>
          <SobjectFieldList
            level={0}
            itemKey={baseKey}
            queryFieldsMap={queryFieldsMap}
            sobject={selectedSObject}
            errorReattempt={handleErrorReattempt}
            onToggleExpand={handleToggleFieldExpand}
            onSelectField={handleFieldSelection}
            onSelectAll={handleFieldSelectAll}
            onFilterChanged={handleFieldFilterChanged}
          />
        </AutoFullHeightContainer>
      )}
    </Fragment>
  );
};

export default QueryChildFieldsComponent;
