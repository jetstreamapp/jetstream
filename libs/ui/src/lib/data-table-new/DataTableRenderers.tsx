import { css } from '@emotion/react';
import { IconName } from '@jetstream/icon-factory';
import { useDebounce } from '@jetstream/shared/ui-utils';
import { ListItem, SalesforceOrgUi } from '@jetstream/types';
import classNames from 'classnames';
import formatISO from 'date-fns/formatISO';
import parseISO from 'date-fns/parseISO';
import { isFunction } from 'lodash';
import { Fragment, FunctionComponent, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { FormatterProps, HeaderRendererProps, useFocusRef } from 'react-data-grid';
import { getSfdcRetUrl } from '../data-table/data-table-utils';
import Checkbox from '../form/checkbox/Checkbox';
import DatePicker from '../form/date/DatePicker';
import Input from '../form/input/Input';
import Picklist from '../form/picklist/Picklist';
import Modal from '../modal/Modal';
import Popover, { PopoverRef } from '../popover/Popover';
import CopyToClipboard from '../widgets/CopyToClipboard';
import Icon from '../widgets/Icon';
import SalesforceLogin from '../widgets/SalesforceLogin';
import './data-table-styles.css';
import {
  ColumnWithFilter,
  DataTableBooleanSetFilter,
  DataTableDateFilter,
  DataTableFilter,
  DataTableSetFilter,
  DataTableTextFilter,
} from './data-table-types';
import { DataTableFilterContext, getRowId, isFilterActive, resetFilter } from './data-table-utils';
import { useVirtualizer } from '@tanstack/react-virtual';

// import {

// CONFIGURATION

let _serverUrl: string;
let _org: SalesforceOrgUi;

export function configIdLinkRenderer(serverUrl: string, org: SalesforceOrgUi) {
  if (_serverUrl !== serverUrl) {
    _serverUrl = serverUrl;
  }
  if (_org !== org) {
    _org = org;
  }
}

// HEADER RENDERERS
export function FilterRenderer<R, SR, T extends HTMLOrSVGElement>({
  isCellSelected,
  onSort,
  sortDirection,
  column,
  children,
}: HeaderRendererProps<R, SR> & {
  children: (
    args: HeaderFilterProps & {
      ref?: React.RefObject<T>;
      tabIndex?: number;
    }
  ) => React.ReactElement;
}) {
  const { filters, filterSetValues, updateFilter } = useContext(DataTableFilterContext)!;
  const { ref, tabIndex } = useFocusRef<T>(isCellSelected);

  // TODO: sort and filter
  const iconName: IconName = sortDirection === 'ASC' ? 'arrowup' : 'arrowdown';

  return (
    <div className="slds-grid slds-grid_align-spread slds-grid_vertical-align-center cursor-pointer" onClick={() => onSort(false)}>
      <div className="slds-truncate">{column.name}</div>
      <div className="slds-grid slds-grid_vertical-align-center">
        {sortDirection && <Icon type="utility" icon={iconName} className="slds-icon slds-icon-text-default slds-icon_xx-small" />}
        <div>{children({ ref, tabIndex, columnKey: column.key, filters: filters[column.key], filterSetValues, updateFilter })}</div>
      </div>
    </div>
  );
}

interface HeaderFilterProps {
  columnKey: string;
  filters: DataTableFilter[];
  filterSetValues: Record<string, string[]>;
  updateFilter: (column: string, filter: DataTableFilter) => void;
}

export function HeaderFilter({ columnKey, filters, filterSetValues, updateFilter }: HeaderFilterProps) {
  const popoverRef = useRef<PopoverRef>();

  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(filters?.some(isFilterActive));
  }, [filters]);

  function getFilter(filter: DataTableFilter) {
    switch (filter.type) {
      case 'TEXT':
        return <HeaderTextFilter columnKey={columnKey} filter={filter} updateFilter={updateFilter} />;
      case 'NUMBER':
        return null;
      case 'DATE':
        return <HeaderDateFilter columnKey={columnKey} filter={filter} updateFilter={updateFilter} />;
      case 'BOOLEAN_SET':
        return (
          <HeaderSetFilter columnKey={columnKey} filter={filter} values={filterSetValues[columnKey] || []} updateFilter={updateFilter} />
        );
      case 'SET':
        return (
          <HeaderSetFilter columnKey={columnKey} filter={filter} values={filterSetValues[columnKey] || []} updateFilter={updateFilter} />
        );
      default:
        return null;
    }
  }

  function handleReset() {
    filters.map((filter) => updateFilter(columnKey, resetFilter(filter.type)));
    popoverRef.current?.close();
  }

  if (!filters?.length) {
    return null;
  }

  return (
    <div
      onClick={(ev) => {
        ev.stopPropagation();
      }}
      onPointerDown={(ev) => ev.stopPropagation()}
    >
      <Popover
        ref={popoverRef}
        header={
          <header className="slds-popover__header" onPointerDown={(ev) => ev.stopPropagation()}>
            <h2 className="slds-text-heading_small">Filter</h2>
          </header>
        }
        footer={
          <footer className="slds-popover__footer">
            <button className="slds-button slds-button_neutral slds-m-top_x-small" onClick={handleReset}>
              Reset
            </button>
          </footer>
        }
        content={
          <div css={css``} onPointerDown={(ev) => ev.stopPropagation()}>
            {filters
              .filter((filter) => filter.type)
              .map((filter, i) => (
                <Fragment key={filter.type}>
                  {i > 0 && <hr className="slds-m-vertical_small" />}
                  <div>{getFilter(filter)}</div>
                </Fragment>
              ))}
          </div>
        }
        buttonProps={{
          className: 'slds-button slds-button_icon',
        }}
      >
        <Icon
          type="utility"
          icon="filter"
          className={classNames('slds-button__icon slds-icon_x-small', {
            'slds-text-color_brand': active,
          })}
        />
      </Popover>
    </div>
  );
}

interface DataTableTextFilterProps {
  columnKey: string;
  filter: DataTableTextFilter;
  updateFilter: (column: string, filter: DataTableFilter) => void;
}

export function HeaderTextFilter({ columnKey, filter, updateFilter }: DataTableTextFilterProps) {
  const [value, setValue] = useState(filter.value);
  const debouncedValue = useDebounce(value, 300);

  useEffect(() => {
    if (filter.value !== debouncedValue) {
      updateFilter(columnKey, { ...filter, value: debouncedValue });
    }
  }, [updateFilter, debouncedValue, columnKey, filter]);

  return (
    <Input className="slds-grow" label="Contains" clearButton={!!value} onClear={() => setValue('')}>
      <input className="slds-input" value={value} onChange={(ev) => setValue(ev.target.value)} />
    </Input>
  );
}

interface HeaderSetFilterProps {
  columnKey: string;
  filter: DataTableSetFilter | DataTableBooleanSetFilter;
  values: string[];
  updateFilter: (column: string, filter: DataTableFilter) => void;
}

export function HeaderSetFilter({ columnKey, filter, values, updateFilter }: HeaderSetFilterProps) {
  const parentRef = useRef<HTMLDivElement>(null);
  const [selectedValues, setSelectedValues] = useState(() => new Set(filter.value.length ? filter.value : values));

  const rowVirtualizer = useVirtualizer({
    count: values.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 20.33,
    overscan: 50,
  });

  const handleSelectAll = (checked: boolean) => {
    const newSet = checked ? new Set(values) : new Set<string>();
    setSelectedValues(newSet);
    updateFilter(columnKey, { ...filter, value: Array.from(newSet) });
  };

  function handleChange(value: string, checked: boolean) {
    const newSet = new Set(selectedValues);
    if (checked) {
      newSet.add(value);
    } else {
      newSet.delete(value);
    }
    setSelectedValues(newSet);
    updateFilter(columnKey, { ...filter, value: Array.from(newSet) });
  }

  return (
    <div
      className="slds-grid slds-grid_vertical"
      css={css`
        max-height: 25vh;
      `}
    >
      <Checkbox
        id={`${columnKey}-select-all`}
        label="(Select All)"
        indeterminate={selectedValues.size > 0 && selectedValues.size < values.length}
        checked={selectedValues.size === values.length}
        onChange={handleSelectAll}
      />
      <div ref={parentRef} className="slds-scrollable_y">
        <div
          css={css`
            height: ${rowVirtualizer.getTotalSize()}px;
            position: relative;
          `}
        >
          {rowVirtualizer.getVirtualItems().map((virtualItem) => (
            <div
              key={virtualItem.key}
              css={css`
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: ${virtualItem.size}px;
                transform: translateY(${virtualItem.start}px);
              `}
            >
              <Checkbox
                id={`${columnKey}-${virtualItem.key}`}
                checkboxClassName="slds-truncate white-space-nowrap"
                label={values[virtualItem.index]}
                checked={selectedValues.has(values[virtualItem.index])}
                onChange={(checked) => handleChange(values[virtualItem.index], checked)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

interface DataTableDateFilterProps {
  columnKey: string;
  filter: DataTableDateFilter;
  updateFilter: (column: string, filter: DataTableFilter) => void;
}

export function HeaderDateFilter({ columnKey, filter, updateFilter }: DataTableDateFilterProps) {
  const [value, setValue] = useState(() => (filter.value ? parseISO(filter.value) : null));
  const [comparators] = useState<ListItem<string, 'EQUALS' | 'GREATER_THAN' | 'LESS_THAN'>[]>(() => [
    { id: 'EQUALS', label: 'Equals', value: 'EQUALS' },
    { id: 'GREATER_THAN', label: 'Greater Than', value: 'GREATER_THAN' },
    { id: 'LESS_THAN', label: 'Less Than', value: 'LESS_THAN' },
  ]);
  const [selectedComparator, setSelectedComparators] = useState<'EQUALS' | 'GREATER_THAN' | 'LESS_THAN'>(() => filter.comparator);

  function handleComparatorChange(comparator: 'EQUALS' | 'GREATER_THAN' | 'LESS_THAN') {
    setSelectedComparators(comparator);
    if (filter.comparator !== comparator) {
      updateFilter(columnKey, { ...filter, comparator });
    }
  }

  function handleDateChange(value: Date) {
    setValue(value);
    updateFilter(columnKey, { ...filter, value: value ? formatISO(value) : null });
  }

  return (
    <div>
      <Picklist
        label="Comparison"
        items={comparators}
        selectedItemIds={[selectedComparator]}
        allowDeselection={false}
        onChange={(items: ListItem<'EQUALS' | 'GREATER_THAN' | 'LESS_THAN'>[]) => handleComparatorChange(items[0].value)}
      />
      <DatePicker
        id={`${columnKey}-datepicker`}
        label="Date Range"
        hideLabel
        className="slds-m-top_small w-100"
        initialSelectedDate={value}
        onChange={handleDateChange}
      />
    </div>
  );
}

// CELL RENDERERS
// export const SubqueryRenderer: FunctionComponent<FormatterProps<any, unknown>> = ({ colDef, data, value }) => {
//   const [columnApi, setColumnApi] = useState<ColumnApi>(null);
//   const isMounted = useRef(null);
//   const [isActive, setIsActive] = useState(false);
//   const [modalTagline, setModalTagline] = useState<string>();
//   const [downloadModalIsActive, setDownloadModalIsActive] = useState(false);
//   const [isLoadingMore, setIsLoadingMore] = useState(false);
//   const [{ records, done, nextRecordsUrl, totalSize }, setQueryResults] = useState<QueryResult<unknown>>(data[colDef.field] || {});

//   useEffect(() => {
//     isMounted.current = true;
//     return () => {
//       isMounted.current = false;
//     };
//   }, []);

//   function handleOnGridReady({ columnApi }: GridReadyEvent) {
//     setColumnApi(columnApi);
//   }

//   function handleViewData() {
//     if (isActive) {
//       setIsActive(false);
//     } else {
//       if (!modalTagline) {
//         setModalTagline(getSubqueryModalTagline(data));
//       }
//       setIsActive(true);
//     }
//   }

//   function getColumns(columnDefinitions: SalesforceQueryColumnDefinition) {
//     return columnDefinitions.subqueryColumns[colDef.field];
//   }

//   function handleCloseModal(cancelled?: boolean) {
//     if (typeof cancelled === 'boolean' && cancelled) {
//       setIsActive(true);
//       setDownloadModalIsActive(false);
//     } else {
//       setIsActive(false);
//       setDownloadModalIsActive(false);
//     }
//   }

//   function openDownloadModal() {
//     setIsActive(false);
//     setDownloadModalIsActive(true);
//   }

//   function handleCopyToClipboard() {
//     const fields = getCurrentColumns(columnApi);
//     const flattenedData = flattenRecords(records, fields);
//     copyToClipboard(transformTabularDataToExcelStr(flattenedData, fields), { format: 'text/plain' });
//   }

//   async function loadMore(org: SalesforceOrgUi, isTooling: boolean) {
//     try {
//       setIsLoadingMore(true);
//       const results = await queryMore(org, nextRecordsUrl, isTooling);
//       if (!isMounted.current) {
//         return;
//       }
//       results.queryResults.records = records.concat(results.queryResults.records);
//       setQueryResults(results.queryResults);
//       setIsLoadingMore(false);
//     } catch (ex) {
//       if (!isMounted.current) {
//         return;
//       }
//       setIsLoadingMore(false);
//     }
//   }

//   function getRowId({ data }: GetRowIdParams): string {
//     if (data?.attributes?.type === 'AggregateResult') {
//       return uniqueId('query-results-node-id');
//     }
//     let nodeId = data?.attributes?.url || data.Id;
//     if (!nodeId) {
//       nodeId = uniqueId('query-results-node-id');
//     }
//     return nodeId;
//   }

//   if (!Array.isArray(value) || value.length === 0) {
//     return <div />;
//   }

//   return (
//     <DataTableContext.Consumer>
//       {({ serverUrl, org, columnDefinitions, isTooling, google_apiKey, google_appId, google_clientId }) => (
//         <div>
//           {isActive && (
//             <Modal
//               size="lg"
//               header={colDef.field}
//               tagline={modalTagline}
//               closeOnBackdropClick
//               onClose={handleCloseModal}
//               footerClassName="slds-is-relative"
//               footer={
//                 <Grid align="spread" verticalAlign="end">
//                   <Grid verticalAlign="end">
//                     <span className="slds-m-right_small">
//                       Showing {formatNumber(records.length)} of {formatNumber(totalSize)} records
//                     </span>
//                     {!done && (
//                       <button className="slds-button slds-button_neutral" onClick={() => loadMore(org, isTooling)}>
//                         Load More
//                       </button>
//                     )}
//                     {isLoadingMore && <Spinner />}
//                   </Grid>
//                   <div>
//                     <button
//                       className="slds-button slds-button_neutral"
//                       onClick={() => handleCopyToClipboard()}
//                       title="Copy the queried records to the clipboard. The records can then be pasted into a spreadsheet."
//                     >
//                       <Icon type="utility" icon="copy_to_clipboard" className="slds-button__icon slds-button__icon_left" omitContainer />
//                       Copy to Clipboard
//                     </button>
//                     <button className="slds-button slds-button_brand" onClick={openDownloadModal}>
//                       <Icon type="utility" icon="download" className="slds-button__icon slds-button__icon_left" omitContainer />
//                       Download Records
//                     </button>
//                   </div>
//                 </Grid>
//               }
//             >
//               <div className="slds-scrollable_x">
//                 <AutoFullHeightContainer fillHeight setHeightAttr bottomBuffer={300}>
//                   <DataTable
//                     // FIXME: commented out
//                     // serverUrl={serverUrl}
//                     // org={org}
//                     columns={getColumns(columnDefinitions)}
//                     data={records}
//                     // agGridProps={{
//                     //   rowSelection: null,
//                     //   getRowId: (data) => getRowId(data),
//                     //   onGridReady: handleOnGridReady,
//                     // }}
//                   />
//                 </AutoFullHeightContainer>
//               </div>
//             </Modal>
//           )}
//           {downloadModalIsActive && (
//             <RecordDownloadModal
//               org={org}
//               google_apiKey={google_apiKey}
//               google_appId={google_appId}
//               google_clientId={google_clientId}
//               downloadModalOpen
//               fields={getAllColumns(columnApi)}
//               modifiedFields={getCurrentColumns(columnApi)}
//               records={records}
//               onModalClose={handleCloseModal}
//             />
//           )}
//           <button className="slds-button" onClick={handleViewData}>
//             <Icon type="utility" icon="search" className="slds-button__icon slds-button__icon_left" omitContainer />
//             {Array.isArray(value) ? `${value.length} Records` : 'View Data'}
//           </button>
//         </div>
//       )}
//     </DataTableContext.Consumer>
//   );
// };

export const ComplexDataRenderer: FunctionComponent<FormatterProps<any, unknown>> = ({ column, row, onRowChange, isCellSelected }) => {
  const value = row[column.key];
  const [isActive, setIsActive] = useState(false);
  const [jsonValue] = useState(JSON.stringify(value || '', null, 2));

  function handleViewData() {
    if (isActive) {
      setIsActive(false);
    } else {
      setIsActive(true);
    }
  }

  function handleCloseModal(cancelled?: boolean) {
    if (typeof cancelled === 'boolean' && cancelled) {
      setIsActive(true);
    } else {
      setIsActive(false);
    }
  }

  return (
    <div>
      {isActive && (
        <Modal
          size="lg"
          header={column.name}
          closeOnBackdropClick
          onClose={handleCloseModal}
          footer={<CopyToClipboard type="button" className="slds-button_neutral" content={jsonValue} />}
        >
          <pre>
            <code>{jsonValue}</code>
          </pre>
        </Modal>
      )}
      <button className="slds-button" onClick={handleViewData}>
        <Icon type="utility" icon="search" className="slds-button__icon slds-button__icon_left" omitContainer />
        View Data
      </button>
    </div>
  );
};

export const IdLinkRenderer: FunctionComponent<FormatterProps<any, unknown>> = ({ column, row, onRowChange, isCellSelected }) => {
  const value = row[column.key];
  const { skipFrontDoorAuth, url } = column.key === 'Id' ? getSfdcRetUrl(value, row) : { skipFrontDoorAuth: false, url: `/${value}` };
  return (
    <div className="slds-truncate" title={`${value}`}>
      <SalesforceLogin serverUrl={_serverUrl} org={_org} returnUrl={url} skipFrontDoorAuth={skipFrontDoorAuth} omitIcon>
        {value}
      </SalesforceLogin>
    </div>
  );
};

// export const ExecuteRenderer: FunctionComponent<FormatterProps<any, unknown>> = ({ node, context }) => {
//   const { className, label, title, disabled, onClick } = context as TableExecuteContext;
//   return (
//     <button
//       className={className || 'slds-button slds-text-link_reset slds-text-link'}
//       title={title}
//       disabled={disabled}
//       onClick={() => onClick(node)}
//     >
//       {label}
//     </button>
//   );
// };

export const ActionRenderer: FunctionComponent<{ row: any }> = ({ row }) => {
  if (!isFunction(row?._action)) {
    return null;
  }
  return (
    <Fragment>
      <button className="slds-button slds-button_icon" title="View Full Record" onClick={() => row._action(row, 'view')}>
        <Icon type="utility" icon="preview" className="slds-button__icon " omitContainer />
      </button>
      <button className="slds-button slds-button_icon" title="Edit Record" onClick={() => row._action(row, 'edit')}>
        <Icon type="utility" icon="edit" className="slds-button__icon " omitContainer />
      </button>
      <button className="slds-button slds-button_icon" title="Clone Record" onClick={() => row._action(row, 'clone')}>
        <Icon type="utility" icon="copy" className="slds-button__icon " omitContainer />
      </button>
      <button className="slds-button slds-button_icon" title="Turn Record Into Apex" onClick={() => row._action(row, 'apex')}>
        <Icon type="utility" icon="apex" className="slds-button__icon " omitContainer />
      </button>
    </Fragment>
  );
};

export const BooleanRenderer: FunctionComponent<FormatterProps<any, unknown>> = ({ column, row, onRowChange, isCellSelected }) => {
  const value = row[column.key];
  return (
    <Checkbox
      className="slds-align_absolute-center"
      id={`${column.key}-${getRowId(row)}`}
      checked={value}
      label="value"
      hideLabel
      readOnly
    />
  );
};

/**
 * This component shows an optional additional component
 */
// export const BooleanEditableRenderer: FunctionComponent<FormatterProps<any, unknown>> = ({ column, row, onRowChange, isCellSelected }) => {
//   const value = row[column.key];
//   let isReadOnly = false;
//   let additionalComponent;
//   if (isFunction(context.isReadOnly)) {
//     isReadOnly = context.isReadOnly({ value, node, column, colDef });
//   }
//   if (isFunction(context.additionalComponent)) {
//     additionalComponent = context.additionalComponent({ value, node, column, colDef });
//   }
//   const colId = column.getColId();
//   function setValue(event: MouseEvent<HTMLDivElement>) {
//     if (!isReadOnly) {
//       event.preventDefault();
//       event.stopPropagation();
//       node.setDataValue(colId, !value);
//     }
//   }

//   return (
//     <div className="slds-align_absolute-center" onClick={setValue}>
//       <Checkbox id={`${node.id}-${colId}`} checked={value} label="value" hideLabel readOnly={isReadOnly} />
//       {additionalComponent && additionalComponent}
//     </div>
//   );
// };

// value is blank, so this is pretty specific for the use-case
// export const FullWidthRenderer: FunctionComponent<FormatterProps<any, unknown>> = ({ value, node, column, colDef }) => {
//   return <div className="slds-align_absolute-center slds-text-heading_medium bg-background-selection">{node.data.label}</div>;
// };

// FILTER RENDERERS

// interface FilterWithFloatingFilterCallback extends IFilter {
//   onFloatingFilterValueChanged(value: string): void;
// }

// export const BasicTextFilterRenderer = forwardRef<any, IFilterParams>((props, ref) => {
//   const { api, colDef, column, columnApi, context, valueGetter, filterChangedCallback } = props;
//   const [value, setValue] = useState('');
//   useEffect(() => {
//     filterChangedCallback();
//   }, [value]);
//   useImperativeHandle(ref, () => {
//     const filterComp: FilterWithFloatingFilterCallback = {
//       onFloatingFilterValueChanged(currValue: string) {
//         setValue(currValue || '');
//       },

//       isFilterActive() {
//         return !!value;
//       },

//       doesFilterPass({ node }) {
//         const fieldValue = valueGetter({
//           api,
//           colDef,
//           column,
//           columnApi,
//           context,
//           data: node.data,
//           getValue: (field) => node.data[field],
//           node,
//         });
//         return value
//           .toLowerCase()
//           .split(' ')
//           .every((word) => fieldValue.toLowerCase().includes(word));
//       },

//       getModel() {
//         return { value };
//       },

//       setModel(model) {
//         setValue(model ? model.value : '');
//       },
//     };
//     return filterComp;
//   });

//   return (
//     <div>
//       <div className="slds-m-around_x-small">
//         <Input>
//           <input className="slds-input" placeholder="Filter..." value={value || ''} onChange={(event) => setValue(event.target.value)} />
//         </Input>
//       </div>
//       <hr className="slds-m-vertical_none" />
//       <div className="slds-grid slds-grid_align-end">
//         <button className="slds-button slds-button_neutral slds-m-around_x-small" onClick={() => setValue('')}>
//           Reset
//         </button>
//       </div>
//     </div>
//   );
// });

/**
 * This requires BasicTextFilterRenderer to be set as the normal filter for the row
 */
// export const BasicTextFloatingFilterRenderer = forwardRef<any, IFloatingFilterParams>(({ parentFilterInstance }, ref) => {
//   const [value, setValue] = useState('');
//   useEffect(() => {
//     parentFilterInstance((instance) => {
//       instance.onFloatingFilterChanged('contains', value);
//     });
//   }, [value]);
//   useImperativeHandle(ref, () => {
//     const filterComp: IFloatingFilter = {
//       onParentModelChanged(parentModel) {
//         setValue(parentModel?.value || '');
//       },
//     };
//     return filterComp;
//   });

//   return (
//     <div className="slds-m-around_x-small">
//       <Input clearButton={!!value} onClear={() => setValue('')}>
//         <input className="slds-input" placeholder="Filter..." value={value} onChange={(event) => setValue(event.target.value)} />
//       </Input>
//     </div>
//   );
// });

// export const BooleanFilterRenderer = forwardRef<any, IFilterParams>((props, ref) => {
//   const { api, colDef, column, columnApi, context, valueGetter, filterChangedCallback } = props;
//   const [isEnabled, setIsEnabled] = useState(false);
//   const [value, setValue] = useState(true);
//   useEffect(() => {
//     filterChangedCallback();
//   }, [isEnabled, value]);

//   useImperativeHandle(ref, () => {
//     const filterComp: IFilter = {
//       isFilterActive() {
//         return isEnabled;
//       },

//       doesFilterPass({ node }) {
//         const fieldValue = valueGetter({
//           api,
//           colDef,
//           column,
//           columnApi,
//           context,
//           data: node.data,
//           getValue: (field) => node.data[field],
//           node,
//         });
//         return fieldValue === value;
//       },

//       getModel() {
//         return { value };
//       },

//       setModel(model) {
//         setValue(model ? model.value : true);
//       },
//     };
//     return filterComp;
//   });

//   return (
//     <div className="slds-p-around_x-small">
//       <CheckboxToggle
//         id={`filter-enabled-${colDef.field}`}
//         label="Enable Filter"
//         onText="Enabled"
//         offText="Disabled"
//         labelPosition="right"
//         checked={isEnabled}
//         onChange={setIsEnabled}
//       />
//       <Checkbox
//         id={`filter-${colDef.field}`}
//         checked={value}
//         label={`Show ${value ? 'Checked' : 'Unchecked'} Items`}
//         disabled={!isEnabled}
//         onChange={setValue}
//       />
//     </div>
//   );
// });
