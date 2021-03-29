/** @jsx jsx */
import { css, jsx } from '@emotion/react';
import { formatNumber } from '@jetstream/shared/ui-utils';
import { REGEX } from '@jetstream/shared/utils';
import { FieldWrapper, MapOf, QueryFields, UpDown } from '@jetstream/types';
import isString from 'lodash/isString';
import { createRef, Fragment, FunctionComponent, useEffect, useState } from 'react';
import Checkbox from '../form/checkbox/Checkbox';
import DropDown from '../form/dropdown/DropDown';
import SearchInput from '../form/search-input/SearchInput';
import Grid from '../grid/Grid';
import EmptyState from '../illustrations/EmptyState';
import List from '../list/List';
import Spinner from '../widgets/Spinner';
import SobjectFieldListFilter from './SobjectFieldListFilter';
import SobjectFieldListItem from './SobjectFieldListItem';
import { FilterType } from './SobjectFieldListTypes';

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
  isTooling: boolean;
  level: number;
  itemKey: string;
  queryFieldsMap: MapOf<QueryFields>;
  sobject: string;
  onToggleExpand: (key: string, field: FieldWrapper, relatedSobject: string) => void;
  onSelectField: (key: string, field: FieldWrapper) => void;
  onSelectAll: (key: string, value: boolean, impactedKeys: string[]) => void;
  onUnselectAll?: () => void;
  onFilterChanged: (key: string, filterTerm: string) => void;
  errorReattempt: (key: string) => void;
}

export const SobjectFieldList: FunctionComponent<SobjectFieldListProps> = ({
  isTooling,
  level,
  itemKey,
  queryFieldsMap,
  sobject,
  onToggleExpand,
  onSelectField,
  onSelectAll,
  onFilterChanged,
  onUnselectAll,
  errorReattempt,
}) => {
  const [queryFields, setQueryFields] = useState<QueryFields>(null);
  const [fieldLength, setFieldLength] = useState<number>(0);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');
  const [filteredFields, setFilteredFields] = useState<FieldWrapper[]>(null);
  const [visibleFields, setVisibleFields] = useState<Set<string>>(null);
  const [selectAll, setSelectAll] = useState<boolean>(false);
  const [searchInputId] = useState(`object-field-${sobject}-filter-${Date.now()}`);
  const [searchTerm, setSearchTerm] = useState<string>('');
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
      setFilteredFields(
        Array.from(visibleFields)
          .map((key) => queryFields.fields[key])
          .filter((field) => {
            switch (activeFilter) {
              case 'creatable':
                return field.metadata.createable;
              case 'updateable':
                return field.metadata.updateable;
              case 'custom':
                return field.metadata.custom;
              case 'non-managed':
                return !REGEX.HAS_NAMESPACE.test(field.metadata.name);
              case 'custom-non-managed':
                return field.metadata.custom && !REGEX.HAS_NAMESPACE.test(field.metadata.name);
              case 'selected':
                return queryFields.selectedFields.has(field.name);
              default:
                return true;
            }
          })
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleFields, activeFilter]);

  // when filtered fields changes, see if handleFieldFilterChanged fields are selected and possibly update allSelected state
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
    onSelectAll(
      itemKey,
      value,
      filteredFields.map((field) => field.name)
    );
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
          isTooling={isTooling}
          level={level}
          parentKey={itemKey}
          field={item}
          queryFieldsMap={queryFieldsMap}
          searchTerm={searchTerm}
          highlightText
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

  function handleFilterChange(active: FilterType) {
    setActiveFilter(active);
  }

  function handleSearchChange(value: string) {
    setSearchTerm(value);
    onFilterChanged(itemKey, value);
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
            <Grid>
              <div className="slds-grow">
                <SearchInput
                  id={searchInputId}
                  placeholder={`Filter ${sobject} Fields`}
                  value={queryFields.filterTerm}
                  onChange={handleSearchChange}
                  onArrowKeyUpDown={handleSearchKeyboard}
                />
                <div className="slds-text-body_small slds-text-color_weak slds-p-left--xx-small">
                  Showing {formatNumber(filteredFields.length)} of {formatNumber(fieldLength)} fields
                </div>
              </div>
              {level === 0 && !!onUnselectAll && (
                <div className="slds-p-horizontal_xx-small">
                  <DropDown
                    position="right"
                    items={[{ id: 'unselect-all', value: 'Unselect All', icon: { type: 'utility', icon: 'dash' } }]}
                    onSelected={onUnselectAll}
                  />
                </div>
              )}
            </Grid>
          </div>
          <Grid
            align="spread"
            className="slds-p-bottom--xx-small slds-p-horizontal--xx-small slds-m-horizontal--xx-small border-bottom-thick"
          >
            <div>
              <Checkbox
                id={`${itemKey}select-all-fields`}
                checked={filteredFields.length > 0 && selectAll}
                label={`Select All (${filteredFields.length})`}
                disabled={filteredFields.length === 0}
                onChange={updateSelectAll}
              />
            </div>
            <div>
              <SobjectFieldListFilter active={activeFilter} onChange={handleFilterChange} />
            </div>
          </Grid>
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
