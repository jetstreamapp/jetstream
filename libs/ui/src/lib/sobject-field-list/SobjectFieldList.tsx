/** @jsx jsx */
import { css, jsx } from '@emotion/core';
import { FieldWrapper, MapOf, QueryFields, UpDown } from '@jetstream/types';
import { isString } from 'lodash';
import { Fragment, FunctionComponent, useEffect, useState, createRef } from 'react';
import Checkbox from '../form/checkbox/Checkbox';
import SearchInput from '../form/search-input/SearchInput';
import EmptyState from '../illustrations/EmptyState';
import List from '../list/List';
import Spinner from '../widgets/Spinner';
import SobjectFieldListItem from './SobjectFieldListItem';
import numeral from 'numeral';

function getBgColor(level: number): string {
  switch (level) {
    case 1: {
      return '#eef1f6';
    }
    case 2: {
      return '#c5d5ea';
    }
    case 3: {
      return '#a9d3ff';
    }
    case 4: {
      return '#96c5f7';
    }
    case 5: {
      return '#758ecd';
    }
  }
}

export interface SobjectFieldListProps {
  level: number;
  itemKey: string;
  queryFieldsMap: MapOf<QueryFields>;
  sobject: string;
  onToggleExpand: (key: string, field: FieldWrapper, relatedSobject: string) => void;
  onSelectField: (key: string, field: FieldWrapper) => void;
  onSelectAll: (key: string, value: boolean) => void;
  onFilterChanged: (key: string, filterTerm: string) => void;
  errorReattempt: (key: string) => void;
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
  errorReattempt,
}) => {
  const [queryFields, setQueryFields] = useState<QueryFields>(null);
  const [fieldLength, setFieldLength] = useState<number>(0);
  const [filteredFields, setFilteredFields] = useState<FieldWrapper[]>(null);
  const [visibleFields, setVisibleFields] = useState<Set<string>>(null);
  const [selectAll, setSelectAll] = useState<boolean>(false);
  const [searchInputId] = useState(`object-field-${sobject}-filter-${Date.now()}`);
  const ulRef = createRef<HTMLUListElement>();

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
          errorReattempt={errorReattempt}
        />
      ),
    };
  }

  function handleSearchKeyboard(direction: UpDown) {
    if (ulRef && ulRef.current) {
      ulRef.current.focus();
    }
  }

  return (
    <div
      className={`query-level-${level}`}
      css={css({
        backgroundColor: getBgColor(level),
      })}
    >
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
      {queryFields && !queryFields.loading && !queryFields.hasError && filteredFields && (
        <Fragment>
          <div className="slds-p-bottom--xx-small">
            <SearchInput
              id={searchInputId}
              placeholder={`Filter ${sobject} Fields`}
              onChange={(value) => onFilterChanged(itemKey, value)}
              onArrowKeyUpDown={handleSearchKeyboard}
            />
            <div className="slds-text-body_small slds-text-color_weak slds-p-left--xx-small">
              Showing {numeral(filteredFields.length).format('0,0')} of {numeral(fieldLength).format('0,0')} fields
            </div>
          </div>
          <div className="slds-p-bottom--xx-small slds-p-left--xx-small slds-m-left--xx-small border-bottom-thick">
            <Checkbox
              id={`${itemKey}select-all-fields`}
              checked={visibleFields.size > 0 && selectAll}
              label={`Select All (${visibleFields.size})`}
              disabled={visibleFields.size === 0}
              onChange={updateSelectAll}
            />
          </div>
          <List
            ref={ulRef}
            items={filteredFields}
            useCheckbox
            isActive={isFieldActive}
            onSelected={handleFieldSelected}
            getContent={getFieldContent}
          />
          {!filteredFields.length && (
            <EmptyState imageWidth={200} showIllustration={level === 0}>
              <p>There are no matching fields</p>
              <p>Adjust your selection.</p>
            </EmptyState>
          )}
        </Fragment>
      )}
      {queryFields && queryFields.hasError && (
        <p className="slds-p-around_medium slds-text-align_center">
          <span className="slds-text-color_error">There was an error loading fields for {queryFields.sobject}.</span>
          <button className="slds-button slds-m-left_xx-small" onClick={() => errorReattempt(itemKey)}>
            Try Again?
          </button>
        </p>
      )}
    </div>
  );
};

export default SobjectFieldList;
