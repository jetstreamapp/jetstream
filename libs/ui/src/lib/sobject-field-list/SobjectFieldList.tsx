import { css } from '@emotion/react';
import { MIME_TYPES } from '@jetstream/shared/constants';
import { formatNumber, saveFile, useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { FieldWrapper, QueryFields, SalesforceOrgUi, UpDown } from '@jetstream/types';
import isString from 'lodash/isString';
import { Fragment, FunctionComponent, createRef, useEffect, useState } from 'react';
import Checkbox from '../form/checkbox/Checkbox';
import DropDown from '../form/dropdown/DropDown';
import SearchInput from '../form/search-input/SearchInput';
import Grid from '../grid/Grid';
import EmptyState from '../illustrations/EmptyState';
import List from '../list/List';
import Icon from '../widgets/Icon';
import SalesforceLogin from '../widgets/SalesforceLogin';
import Spinner from '../widgets/Spinner';
import { DEFAULT_FILTER_TYPES, FilterTypes, SobjectFieldListFilter } from './SobjectFieldListFilterNew';
import SobjectFieldListItem from './SobjectFieldListItem';
import { filterFieldsFn, getBgColor } from './sobject-field-list-utils';

function getFilteredFields(visibleFields: Set<string>, queryFields: QueryFields, activeFilters: FilterTypes) {
  return Array.from(visibleFields)
    .map((key) => queryFields?.fields?.[key])
    .filter(Boolean)
    .filter(filterFieldsFn(activeFilters, queryFields.selectedFields)) as FieldWrapper[];
}

export interface SobjectFieldListProps {
  org: SalesforceOrgUi;
  serverUrl: string;
  isTooling: boolean;
  level: number;
  itemKey: string;
  queryFieldsMap: Record<string, QueryFields>;
  sobject: string;
  onToggleExpand: (key: string, field: FieldWrapper, relatedSobject: string) => void;
  onSelectField: (key: string, field: FieldWrapper) => void;
  onSelectAll: (key: string, value: boolean, impactedKeys: string[]) => void;
  onUnselectAll?: () => void;
  onFilterChanged: (key: string, filterTerm: string) => void;
  errorReattempt: (key: string) => void;
}

export const SobjectFieldList: FunctionComponent<SobjectFieldListProps> = ({
  org,
  serverUrl,
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
  const [queryFields, setQueryFields] = useState<QueryFields | null>(() => {
    if (isString(itemKey) && queryFieldsMap[itemKey]) {
      return queryFieldsMap[itemKey];
    }
    return null;
  });
  const [fieldLength, setFieldLength] = useState<number>(() => {
    if (isString(itemKey) && queryFieldsMap[itemKey]) {
      return Object.keys(queryFieldsMap[itemKey].fields).length;
    }
    return 0;
  });
  const [activeFilters, setActiveFilters] = useState<FilterTypes>({ ...DEFAULT_FILTER_TYPES });
  const [filteredFields, setFilteredFields] = useState<FieldWrapper[] | null>(() => {
    if (isString(itemKey) && queryFieldsMap[itemKey] && queryFieldsMap[itemKey].visibleFields) {
      //
      return Array.from(queryFieldsMap[itemKey].visibleFields)
        .map((key) => queryFieldsMap[itemKey].fields[key])
        .filter(filterFieldsFn(activeFilters, queryFields?.selectedFields));
    }
    return null;
  });

  const [selectAll, setSelectAll] = useState<boolean>(false);
  const [searchInputId] = useState(`object-field-${sobject}-filter-${Date.now()}`);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const ulRef = createRef<HTMLUListElement>();

  useNonInitialEffect(() => {
    if (isString(itemKey) && queryFieldsMap[itemKey]) {
      const queryFields = queryFieldsMap[itemKey];
      setQueryFields(queryFields);
      setFieldLength(Object.keys(queryFields.fields).length);
      setFilteredFields(getFilteredFields(queryFields.visibleFields, queryFields, activeFilters));
    }
  }, [activeFilters, itemKey, queryFieldsMap]);

  // when filtered fields changes, see if handleFieldFilterChanged fields are selected and possibly update allSelected state
  useEffect(() => {
    if (filteredFields && filteredFields?.length > 0) {
      const allSelected = filteredFields.every((field) => queryFields?.selectedFields.has(field.name));
      if (allSelected !== selectAll) {
        setSelectAll(allSelected);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredFields]);

  // When select all is explicitly modified, update field selection for visible fields
  function updateSelectAll(value: boolean) {
    setSelectAll(value);
    onSelectAll(itemKey, value, filteredFields?.map((field) => field.name) || []);
  }

  function isFieldActive(field: FieldWrapper) {
    return queryFields?.selectedFields.has(field.name) || false;
  }

  function handleFieldSelected(fieldName: string) {
    queryFields?.fields[fieldName] && onSelectField(itemKey, queryFields.fields[fieldName]);
  }

  function getFieldContent(item: FieldWrapper) {
    return {
      key: item.name,
      id: `${itemKey}${item.name}`,
      heading: (
        <SobjectFieldListItem
          org={org}
          serverUrl={serverUrl}
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

  function handleFilterChange(selectedItems: FilterTypes) {
    setActiveFilters(selectedItems);
  }

  function handleSearchChange(value: string) {
    setSearchTerm(value);
    onFilterChanged(itemKey, value);
  }

  function handleDownloadMetadata() {
    queryFields && saveFile(JSON.stringify(queryFields.metadata, null, 2), `object-metadata-${sobject}.json`, MIME_TYPES.JSON);
  }

  return (
    <div
      className={`query-level-${level}`}
      css={css({
        backgroundColor: getBgColor(level),
      })}
      data-testid={level ? `sobject-fields-${level}-${sobject}` : `sobject-fields`}
      // Ensure random events to don propagate to parent list item
      onClick={(ev) => ev.stopPropagation()}
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
          <div className="slds-p-bottom_xx-small">
            <Grid className="slds-p-top_xx-small slds-p-left_xx-small">
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
              {!isTooling && (
                <SalesforceLogin
                  serverUrl={serverUrl}
                  org={org}
                  skipFrontDoorAuth
                  returnUrl={`/lightning/setup/ObjectManager/${sobject}/Details/view`}
                  omitIcon
                  title={`View object in Salesforce setup`}
                >
                  <Icon
                    css={css`
                      &:hover {
                        fill: #005fb2;
                      }
                    `}
                    type="utility"
                    icon="new_window"
                    className="slds-icon slds-icon-text-default slds-icon_xx-small"
                    omitContainer
                  />
                </SalesforceLogin>
              )}
              <button
                className="slds-button slds-button_icon slds-button_icon-container"
                title="Download metadata for object"
                onClick={handleDownloadMetadata}
              >
                <Icon type="utility" icon="download" className="slds-button__icon" omitContainer />
              </button>
              <SobjectFieldListFilter selectedItems={activeFilters} onChange={handleFilterChange} />
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
          {!queryFields.loading && !filteredFields.length && (
            <EmptyState
              omitIllustration={level > 0}
              headline="There are no matching fields"
              subHeading="Adjust your selection."
            ></EmptyState>
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
