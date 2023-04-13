import { css } from '@emotion/react';
import { IconName } from '@jetstream/icon-factory';
import { useDebounce } from '@jetstream/shared/ui-utils';
import { multiWordStringFilter } from '@jetstream/shared/utils';
import { ListItem, SalesforceOrgUi } from '@jetstream/types';
import { useVirtualizer } from '@tanstack/react-virtual';
import classNames from 'classnames';
import formatISO from 'date-fns/formatISO';
import parseISO from 'date-fns/parseISO';
import isBoolean from 'lodash/isBoolean';
import isFunction from 'lodash/isFunction';
import { Fragment, FunctionComponent, memo, MutableRefObject, useContext, useEffect, useRef, useState } from 'react';
import { FormatterProps, GroupFormatterProps, headerRenderer, HeaderRendererProps, useFocusRef, useRowSelection } from 'react-data-grid';
import { useDrag, useDrop } from 'react-dnd';
import Checkbox from '../form/checkbox/Checkbox';
import DatePicker from '../form/date/DatePicker';
import Input from '../form/input/Input';
import Picklist from '../form/picklist/Picklist';
import SearchInput from '../form/search-input/SearchInput';
import TimePicker from '../form/time-picker/TimePicker';
import Modal from '../modal/Modal';
import Popover, { PopoverRef } from '../popover/Popover';
import CopyToClipboard from '../widgets/CopyToClipboard';
import Icon from '../widgets/Icon';
import SalesforceLogin from '../widgets/SalesforceLogin';
import Spinner from '../widgets/Spinner';
import { DataTableFilterContext, DataTableSelectedContext } from './data-table-context';
import { dataTableDateFormatter } from './data-table-formatters';
import {
  DataTableBooleanSetFilter,
  DataTableDateFilter,
  DataTableFilter,
  DataTableSetFilter,
  DataTableTextFilter,
  DataTableTimeFilter,
  RowWithKey,
} from './data-table-types';
import { getRowId, getSfdcRetUrl, isFilterActive, resetFilter } from './data-table-utils';

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

/**
 * DRAGGABLE COLUMNS, ALLOW REORDERING
 */
interface DraggableHeaderRendererProps<R> extends HeaderRendererProps<R> {
  onColumnsReorder: (sourceKey: string, targetKey: string) => void;
}

export function DraggableHeaderRenderer<R>({ onColumnsReorder, column, ...props }: DraggableHeaderRendererProps<R>) {
  const [{ isDragging }, drag] = useDrag({
    type: 'COLUMN_DRAG',
    item: { key: column.key },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [{ isOver }, drop] = useDrop({
    accept: 'COLUMN_DRAG',
    drop({ key }: { key: string }) {
      onColumnsReorder(key, column.key);
    },
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  });

  return (
    <div
      ref={(ref) => {
        drag(ref);
        drop(ref);
      }}
      style={{
        opacity: isDragging ? 0.5 : 1,
        backgroundColor: isOver ? '#ececec' : undefined,
        cursor: isDragging ? 'move' : undefined,
      }}
    >
      {(column as any)._priorHeaderRenderer
        ? (column as any)._priorHeaderRenderer({ column, ...props })
        : headerRenderer({ column, ...props })}
    </div>
  );
}

/**
 * SELECT ALL CHECKBOX HEADER
 */
export function SelectHeaderRenderer<T>(props: HeaderRendererProps<T>) {
  const { column } = props;
  const [isRowSelected, onRowSelectionChange] = useRowSelection();

  return (
    <Checkbox
      id={`checkbox-${column.name}_header`} // TODO: need way to get row id
      label="Select all"
      hideLabel
      checked={isRowSelected}
      onChange={(checked) => onRowSelectionChange({ type: 'HEADER', checked })}
      // WAITING ON: https://github.com/adazzle/react-data-grid/issues/3058
      // indeterminate={props.row.getIsSomeSelected()}
    />
  );
}

export function SelectHeaderGroupRenderer<T>(props: GroupFormatterProps<T>) {
  const { column, groupKey, row, childRows } = props;
  const [isRowSelected, onRowSelectionChange] = useRowSelection();

  return (
    <DataTableSelectedContext.Consumer>
      {({ selectedRowIds, getRowKey }) => (
        <Checkbox
          id={`checkbox-${column.name}_${groupKey}_header`} // TODO: need way to get row id
          label="Select all"
          hideLabel
          checked={isRowSelected}
          indeterminate={selectedRowIds.size > 0 && childRows.some((childRow) => selectedRowIds.has((getRowKey || getRowId)(childRow)))}
          onChange={(checked) => onRowSelectionChange({ type: 'ROW', row: row, checked, isShiftClick: false })}
        />
      )}
    </DataTableSelectedContext.Consumer>
  );
}

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
  const { filters, filterSetValues, portalRefForFilters, updateFilter } = useContext(DataTableFilterContext);
  const { ref, tabIndex } = useFocusRef<T>(isCellSelected);

  const iconName: IconName = sortDirection === 'ASC' ? 'arrowup' : 'arrowdown';

  return (
    <div className="slds-grid slds-grid_align-spread slds-grid_vertical-align-center cursor-pointer" onClick={() => onSort(false)}>
      <div className="slds-truncate">{column.name}</div>
      <div className="slds-grid slds-grid_vertical-align-center">
        {sortDirection && <Icon type="utility" icon={iconName} className="slds-icon slds-icon-text-default slds-icon_xx-small" />}
        <div>
          {children({
            ref,
            tabIndex,
            columnKey: column.key,
            filters: filters[column.key],
            filterSetValues,
            portalRefForFilters,
            updateFilter,
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Filter renderer that can be used for any field that does not need sort
 * This can be used on summary rows as well to solve for headers that span multiple columns
 */
export function SummaryFilterRenderer({ columnKey, label }: { columnKey: string; label: string }) {
  const { filters, filterSetValues, portalRefForFilters, updateFilter } = useContext(DataTableFilterContext);
  return (
    <div className="slds-grid slds-grid_align-spread slds-grid_vertical-align-center">
      <div className="slds-truncate">{label}</div>
      <HeaderFilter
        columnKey={columnKey}
        filters={filters[columnKey]}
        filterSetValues={filterSetValues}
        portalRefForFilters={portalRefForFilters}
        updateFilter={updateFilter}
      />
    </div>
  );
}

interface HeaderFilterProps {
  columnKey: string;
  filters: DataTableFilter[];
  filterSetValues: Record<string, string[]>;
  portalRefForFilters: MutableRefObject<HTMLElement>;
  updateFilter: (column: string, filter: DataTableFilter) => void;
}

export const HeaderFilter = memo(({ columnKey, filters, filterSetValues, portalRefForFilters, updateFilter }: HeaderFilterProps) => {
  const popoverRef = useRef<PopoverRef>(null);

  const [active, setActive] = useState(false);

  useEffect(() => {
    setActive(filters?.some((filter) => isFilterActive(filter, (filterSetValues[columnKey] || []).length)));
  }, [columnKey, filterSetValues, filters]);

  function getFilter(filter: DataTableFilter, autoFocus = false) {
    switch (filter.type) {
      case 'TEXT':
        return <HeaderTextFilter columnKey={columnKey} filter={filter} updateFilter={updateFilter} autoFocus={autoFocus} />;
      case 'NUMBER':
        return null;
      case 'DATE':
        return <HeaderDateFilter columnKey={columnKey} filter={filter} updateFilter={updateFilter} />;
      case 'TIME':
        return <HeaderTimeFilter columnKey={columnKey} filter={filter} updateFilter={updateFilter} />;
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
    filters.map((filter) => updateFilter(columnKey, resetFilter(filter.type, filterSetValues[columnKey] || [])));
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
        portalRef={portalRefForFilters?.current}
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
          <div onPointerDown={(ev) => ev.stopPropagation()}>
            {filters
              .filter((filter) => filter.type)
              .map((filter, i) => (
                <Fragment key={filter.type}>
                  {i > 0 && <hr className="slds-m-vertical_small" />}
                  <div>{getFilter(filter, i === 0)}</div>
                </Fragment>
              ))}
          </div>
        }
        buttonProps={{
          className: 'slds-button slds-button_icon',
          onClick: (ev) => ev.stopPropagation(),
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
});

interface DataTableTextFilterProps {
  columnKey: string;
  filter: DataTableTextFilter;
  autoFocus?: boolean;
  updateFilter: (column: string, filter: DataTableFilter) => void;
}

export const HeaderTextFilter = memo(({ columnKey, filter, autoFocus = false, updateFilter }: DataTableTextFilterProps) => {
  const [value, setValue] = useState(filter.value);
  const debouncedValue = useDebounce(value, 300);

  useEffect(() => {
    if (filter.value !== debouncedValue) {
      updateFilter(columnKey, { ...filter, value: debouncedValue });
    }
  }, [updateFilter, debouncedValue, columnKey, filter]);

  return (
    <Input className="slds-grow" label="Contains" clearButton={!!value} onClear={() => setValue('')}>
      <input className="slds-input" value={value} onChange={(ev) => setValue(ev.target.value)} autoFocus={autoFocus} />
    </Input>
  );
});

interface HeaderSetFilterProps {
  columnKey: string;
  filter: DataTableSetFilter | DataTableBooleanSetFilter;
  values: string[];
  updateFilter: (column: string, filter: DataTableFilter) => void;
}

export const HeaderSetFilter = memo(({ columnKey, filter, values, updateFilter }: HeaderSetFilterProps) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const [selectedValues, setSelectedValues] = useState(() => new Set<string>(filter.value));
  const [visibleItems, setVisibleItems] = useState(values);
  const [searchTerm, setSearchTerm] = useState('');
  const [allItemsSelected, setAllItemsSelected] = useState(true);
  const [indeterminate, setIndeterminate] = useState(false);

  useEffect(() => {
    if (searchTerm) {
      setVisibleItems(values.filter(multiWordStringFilter(searchTerm)));
    } else {
      setVisibleItems(values);
    }
  }, [searchTerm, values]);

  useEffect(() => {
    const allItemsSelected = visibleItems.every((item) => selectedValues.has(item));
    setIndeterminate(!allItemsSelected && visibleItems.some((item) => selectedValues.has(item)));
    setAllItemsSelected(allItemsSelected);
  }, [selectedValues, visibleItems]);

  const rowVirtualizer = useVirtualizer({
    count: visibleItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 20.33,
    overscan: 50,
  });

  const handleSelectAll = (checked: boolean) => {
    const newSet = new Set(selectedValues);
    if (checked) {
      visibleItems.forEach((item) => newSet.add(item));
    } else {
      visibleItems.forEach((item) => newSet.delete(item));
    }
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

  const hasVisibleItems = visibleItems.length > 0;

  return (
    <div
      className="slds-grid slds-grid_vertical"
      css={css`
        max-height: 25vh;
      `}
    >
      <SearchInput id={`${columnKey}-filter`} className="slds-p-bottom_x-small" placeholder="Search..." onChange={setSearchTerm} />
      {!hasVisibleItems && <div>No items</div>}
      {hasVisibleItems && (
        <>
          <Checkbox
            id={`${columnKey}-select-all`}
            label="(Select All)"
            indeterminate={indeterminate}
            checked={allItemsSelected}
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
                    label={visibleItems[virtualItem.index]}
                    checked={selectedValues.has(visibleItems[virtualItem.index])}
                    onChange={(checked) => handleChange(visibleItems[virtualItem.index], checked)}
                  />
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
});

interface DataTableDateFilterProps {
  columnKey: string;
  filter: DataTableDateFilter;
  updateFilter: (column: string, filter: DataTableFilter) => void;
}

export const HeaderDateFilter = memo(({ columnKey, filter, updateFilter }: DataTableDateFilterProps) => {
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
        initialSelectedDate={value || undefined}
        onChange={handleDateChange}
      />
    </div>
  );
});

interface HeaderTimeFilterProps {
  columnKey: string;
  filter: DataTableTimeFilter;
  updateFilter: (column: string, filter: DataTableFilter) => void;
}

export const HeaderTimeFilter = memo(({ columnKey, filter, updateFilter }: HeaderTimeFilterProps) => {
  const [value, setValue] = useState(() => filter.value);
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

  function handleTimeChange(value: string) {
    setValue(value);
    updateFilter(columnKey, { ...filter, value });
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
      <TimePicker
        id={`${columnKey}-time-picker`}
        label="Time"
        hideLabel
        className="slds-m-top_small w-100"
        selectedItem={value as string}
        stepInMinutes={15}
        onChange={handleTimeChange}
      />
    </div>
  );
});

// CELL RENDERERS
/** Generic cell renderer when the type of data is unknown */
export function GenericRenderer(formatterProps: FormatterProps<RowWithKey>) {
  const { column, row } = formatterProps;

  if (!row) {
    return <div />;
  }

  let value = row[column.key];

  if (value instanceof Date) {
    value = dataTableDateFormatter(value);
  } else if (isBoolean(value)) {
    return <BooleanRenderer {...formatterProps} />;
  } else if (value && typeof value === 'object') {
    value = <ComplexDataRenderer {...formatterProps} />;
  }

  return <div className="slds-truncate">{value}</div>;
}

export function SelectFormatter<T>(props: FormatterProps<T>) {
  const { column, row } = props;
  const [isRowSelected, onRowSelectionChange] = useRowSelection();

  return (
    <Checkbox
      id={`checkbox-${column.name}-${getRowId(row)}`} // TODO: need way to get row id
      label="Select row"
      hideLabel
      checked={isRowSelected}
      onChange={(checked) => onRowSelectionChange({ type: 'ROW', row, checked, isShiftClick: false })}
    />
  );
}

export function ValueOrLoadingRenderer<T extends { loading: boolean }>({ column, row }: FormatterProps<T>) {
  if (!row) {
    return <div />;
  }
  const { loading } = row;
  const value = row[column.key];
  if (loading) {
    return <Spinner size={'x-small'} />;
  }
  return <div>{value}</div>;
}

export const ComplexDataRenderer: FunctionComponent<FormatterProps<RowWithKey, unknown>> = ({ column, row }) => {
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
      <button className="slds-button slds-button_icon" title="Copy Record as JSON" onClick={() => row._action(row, 'json')}>
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
