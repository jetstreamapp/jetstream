/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { MapOf } from '@silverthorn/types';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { FieldWrapper, QueryFields } from '@silverthorn/types';
import Checkbox from '../form/checkbox/Checkbox';
import List from '../list/List';
import SearchInput from '../form/search-input/SearchInput';
import Spinner from '../widgets/Spinner';
import SobjectFieldListItem from './SobjectFieldListItem';
import { isString } from 'lodash';

export interface SobjectFieldListProps {
  level: number;
  itemKey: string;
  queryFieldsMap: MapOf<QueryFields>;
  sobject: string;
  onToggleExpand: (key: string, field: FieldWrapper) => void;
  onSelectField: (key: string, field: FieldWrapper) => void;
  onSelectAll: (key: string, value: boolean) => void;
  onFilterChanged: (key: string, filterTerm: string) => void;
}

export const SobjectFieldList: FunctionComponent<SobjectFieldListProps> = ({
  level,
  itemKey,
  queryFieldsMap,
  sobject,
  onToggleExpand,
  onSelectField,
  onSelectAll,
  onFilterChanged,
}) => {
  const [queryFields, setQueryFields] = useState<QueryFields>(null);
  const [fieldLength, setFieldLength] = useState<number>(0);
  const [filteredFields, setFilteredFields] = useState<FieldWrapper[]>(null);
  const [visibleFields, setVisibleFields] = useState<Set<string>>(null);

  // const [searchTerm, setSearchTerm] = useState<string>(''); // can I use this from queryFieldsMap?
  const [selectAll, setSelectAll] = useState<boolean>(false);

  useEffect(() => {
    if (isString(itemKey) && queryFieldsMap[itemKey]) {
      const queryFields = queryFieldsMap[itemKey];
      setQueryFields(queryFields);
      setFieldLength(Object.keys(queryFields.fields).length);
      setVisibleFields(queryFields.visibleFields); // instance only changes if filtered fields was actually modified
    }
  }, [itemKey, queryFieldsMap]);

  useEffect(() => {
    if (visibleFields) {
      setFilteredFields(Array.from(visibleFields).map((key) => queryFields.fields[key]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleFields]);

  // when filtered fields changes, see if all fields are selected and possibly update allSelected state
  useEffect(() => {
    if (filteredFields?.length > 0) {
      const allSelected = filteredFields.every((field) => queryFields.selectedFields.has(field.name));
      if (allSelected !== selectAll) {
        setSelectAll(allSelected);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredFields]);

  // When select all is explicitly modified, update field selection for visible fields
  function updateSelectAll(value: boolean) {
    setSelectAll(value);
    onSelectAll(itemKey, value);
  }

  function isFieldActive(field: FieldWrapper) {
    return queryFields.selectedFields.has(field.name);
  }

  function handleFieldSelected(fieldName: string) {
    onSelectField(itemKey, queryFields.fields[fieldName]);
  }

  function getFieldContent(item: FieldWrapper) {
    return {
      key: item.name,
      id: `${itemKey}${item.name}`,
      heading: (
        <SobjectFieldListItem
          level={level}
          parentKey={itemKey}
          field={item}
          queryFieldsMap={queryFieldsMap}
          onToggleExpand={onToggleExpand}
          onSelectField={onSelectField}
          onSelectAll={onSelectAll}
          onFilterChanged={onFilterChanged}
        />
      ),
    };
  }

  return (
    <Fragment>
      {queryFields?.loading && (
        <div
          className="slds-is-relative"
          css={css`
            min-height: 50px;
          `}
        >
          <Spinner />
        </div>
      )}
      {!queryFields?.loading && filteredFields && (
        <Fragment>
          <div className="slds-p-bottom--xx-small">
            <SearchInput
              id="object-field-filter"
              placeholder={`Filter ${sobject} Fields`}
              onChange={(value) => onFilterChanged(itemKey, value)}
            />
            <div className="slds-text-body_small slds-text-color_weak slds-p-left--xx-small">
              Showing {filteredFields.length} of {fieldLength} fields
            </div>
          </div>
          <div className="slds-p-bottom--xx-small slds-p-left--xx-small slds-m-left--xx-small">
            <Checkbox
              id={`${itemKey}select-all-fields`}
              checked={visibleFields.size > 0 && selectAll}
              label={`Select All (${visibleFields.size})`}
              disabled={visibleFields.size === 0}
              onChange={updateSelectAll}
            />
          </div>
          <List items={filteredFields} useCheckbox isActive={isFieldActive} onSelected={handleFieldSelected} getContent={getFieldContent} />
        </Fragment>
      )}
    </Fragment>
  );
};

export default SobjectFieldList;
