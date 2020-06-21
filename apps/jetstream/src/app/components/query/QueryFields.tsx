import { MapOf, SalesforceOrg } from '@jetstream/types';
import { DescribeGlobalSObjectResult } from 'jsforce';
import React, { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { FieldWrapper, QueryFields } from '@jetstream/types';
import { SobjectFieldList } from '@jetstream/ui';
import { sortQueryFieldsStr, fetchFields, getFieldKey } from '@jetstream/shared/ui-utils';
import { AutoFullHeightContainer } from '@jetstream/ui';
import { useRecoilValue, useRecoilState } from 'recoil';
import { selectedOrgState } from '../../app-state';
import * as fromQueryState from './query.state';
import { isEmpty } from 'lodash';

export interface QueryFieldsProps {
  selectedSObject: DescribeGlobalSObjectResult;
  onSelectionChanged: (fields: string[]) => void;
  // onFieldsFetched: (queryFields: MapOf<QueryFields>) => void;
}

function getQueryFieldKey(selectedOrg: SalesforceOrg, selectedSObject: DescribeGlobalSObjectResult) {
  return `${selectedOrg?.uniqueId}-${selectedSObject?.name}`;
}

export const QueryFieldsComponent: FunctionComponent<QueryFieldsProps> = ({ selectedSObject, onSelectionChanged }) => {
  // const [queryFieldsMap, setQueryFieldsMap] = useState<MapOf<QueryFields>>({});
  const [queryFieldsMap, setQueryFieldsMap] = useRecoilState(fromQueryState.queryFieldsMapState);
  const [queryFieldsKey, setQueryFieldsKey] = useRecoilState(fromQueryState.queryFieldsKey);
  const [baseKey, setBaseKey] = useState<string>(`${selectedSObject.name}|`);
  const selectedOrg = useRecoilValue(selectedOrgState);

  // Fetch fields for base object if the selected object changes
  useEffect(() => {
    const fieldKey = getQueryFieldKey(selectedOrg, selectedSObject);
    if (isEmpty(queryFieldsMap) || fieldKey !== queryFieldsKey) {
      // init query fields when object changes
      let tempQueryFieldsMap: MapOf<QueryFields> = {};
      setQueryFieldsMap(tempQueryFieldsMap);
      if (selectedSObject) {
        const BASE_KEY = `${selectedSObject.name}|`;
        setBaseKey(BASE_KEY);
        tempQueryFieldsMap = { ...tempQueryFieldsMap };
        tempQueryFieldsMap[BASE_KEY] = {
          key: BASE_KEY,
          expanded: true,
          loading: true,
          filterTerm: '',
          sobject: selectedSObject.name,
          fields: {},
          visibleFields: new Set(),
          selectedFields: new Set(),
        };
        setQueryFieldsMap(tempQueryFieldsMap);
        setQueryFieldsKey(getQueryFieldKey(selectedOrg, selectedSObject));
        (async () => {
          tempQueryFieldsMap = { ...tempQueryFieldsMap };
          tempQueryFieldsMap[BASE_KEY] = await fetchFields(selectedOrg, tempQueryFieldsMap[BASE_KEY], BASE_KEY);
          tempQueryFieldsMap[BASE_KEY] = { ...tempQueryFieldsMap[BASE_KEY], loading: false };
          setQueryFieldsMap(tempQueryFieldsMap);
        })();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedOrg, selectedSObject]);

  function emitSelectedFieldsChanged(fieldsMap: MapOf<QueryFields> = queryFieldsMap) {
    const fields = Object.values(fieldsMap).flatMap((queryField) => {
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
        filterTerm: '',
        sobject: field.relatedSobject as string,
        fields: {},
        visibleFields: new Set(),
        selectedFields: new Set(),
      };
      // fetch fields and update once resolved
      (async () => {
        // TODO: what if object selection changed? may need to ensure key still exists
        clonedQueryFieldsMap[key] = await fetchFields(selectedOrg, clonedQueryFieldsMap[key], key);
        clonedQueryFieldsMap[key] = { ...clonedQueryFieldsMap[key], loading: false };
        setQueryFieldsMap(clonedQueryFieldsMap);
      })();
    }
    setQueryFieldsMap({ ...clonedQueryFieldsMap });
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
        <AutoFullHeightContainer>
          <SobjectFieldList
            level={0}
            itemKey={baseKey}
            queryFieldsMap={queryFieldsMap}
            sobject={selectedSObject.name}
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

export default QueryFieldsComponent;
