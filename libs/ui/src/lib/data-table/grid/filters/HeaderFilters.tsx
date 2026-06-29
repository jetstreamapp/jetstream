/* eslint-disable @typescript-eslint/no-explicit-any */
import { css } from '@emotion/react';
import { useDebounce } from '@jetstream/shared/ui-utils';
import { multiWordStringFilter } from '@jetstream/shared/utils';
import { ListItem } from '@jetstream/types';
import { useVirtualizer } from '@tanstack/react-virtual';
import classNames from 'classnames';
import { formatISO } from 'date-fns/formatISO';
import { parseISO } from 'date-fns/parseISO';
import { Fragment, memo, useContext, useEffect, useRef, useState } from 'react';
import Checkbox from '../../../form/checkbox/Checkbox';
import DatePicker from '../../../form/date/DatePicker';
import Input from '../../../form/input/Input';
import Picklist from '../../../form/picklist/Picklist';
import SearchInput from '../../../form/search-input/SearchInput';
import TimePicker from '../../../form/time-picker/TimePicker';
import { Popover, PopoverRef } from '../../../popover/Popover';
import Icon from '../../../widgets/Icon';
import { GridFilterContext } from '../grid-context';
import { isFilterActive, resetFilter } from '../grid-filters';
import {
  DataTableBooleanSetFilter,
  DataTableDateFilter,
  DataTableFilter,
  DataTableNumberFilter,
  DataTableSetFilter,
  DataTableTextFilter,
  DataTableTimeFilter,
} from '../grid-types';

type Comparator = 'EQUALS' | 'GREATER_THAN' | 'LESS_THAN';
const COMPARATOR_ITEMS: ListItem<string, Comparator>[] = [
  { id: 'EQUALS', label: 'Equals', value: 'EQUALS' },
  { id: 'GREATER_THAN', label: 'Greater Than', value: 'GREATER_THAN' },
  { id: 'LESS_THAN', label: 'Less Than', value: 'LESS_THAN' },
];

interface UpdateFilterFn {
  (column: string, filter: DataTableFilter): void;
}

/**
 * Header filter popover trigger. Rendered by HeaderCell for any column that declares `filters`.
 * Reads the active filters / distinct set values from GridFilterContext and renders the appropriate
 * filter UIs (one per declared filter type) inside a popover.
 */
/**
 * Filter for a summary/header cell that doesn't need sort — renders a label plus the filter popover.
 * Used by columns that span multiple summary columns (e.g. permission manager bulk-action header).
 */
export const SummaryFilterRenderer = memo(({ columnKey, label }: { columnKey: string; label: string }) => {
  // `flex: 1` so this fills the (flex) summary cell — otherwise `align-spread` has no room to work and the
  // filter trigger sits next to the label instead of pinned to the column's right edge.
  return (
    <div className="slds-grid slds-grid_align-spread slds-grid_vertical-align-center" style={{ flex: '1 1 auto', minInlineSize: 0 }}>
      <div className="slds-truncate">{label}</div>
      <HeaderFilterButton columnKey={columnKey} columnName={label} />
    </div>
  );
});

export const HeaderFilterButton = memo(({ columnKey, columnName }: { columnKey: string; columnName?: string }) => {
  const { filters: allFilters, filterSetValues, updateFilter } = useContext(GridFilterContext);
  const filters = allFilters[columnKey];
  const [active, setActive] = useState(false);
  const popoverRef = useRef<PopoverRef>(null);

  useEffect(() => {
    setActive(!!filters?.some((filter) => isFilterActive(filter, (filterSetValues[columnKey] || []).length)));
  }, [columnKey, filterSetValues, filters]);

  function getFilter(filter: DataTableFilter, autoFocus = false) {
    switch (filter.type) {
      case 'TEXT':
        return <HeaderTextFilter columnKey={columnKey} filter={filter} updateFilter={updateFilter} autoFocus={autoFocus} />;
      case 'NUMBER':
        return <HeaderNumberFilter columnKey={columnKey} filter={filter} updateFilter={updateFilter} autoFocus={autoFocus} />;
      case 'DATE':
        return <HeaderDateFilter columnKey={columnKey} filter={filter} updateFilter={updateFilter} />;
      case 'TIME':
        return <HeaderTimeFilter columnKey={columnKey} filter={filter} updateFilter={updateFilter} />;
      case 'BOOLEAN_SET':
      case 'SET':
        return (
          <HeaderSetFilter columnKey={columnKey} filter={filter} values={filterSetValues[columnKey] || []} updateFilter={updateFilter} />
        );
      default:
        return null;
    }
  }

  function handleReset() {
    filters.forEach((filter) => updateFilter(columnKey, resetFilter(filter.type, filterSetValues[columnKey] || [])));
    popoverRef.current?.close();
  }

  if (!filters?.length) {
    return null;
  }

  return (
    <div onClick={(ev) => ev.stopPropagation()} onPointerDown={(ev) => ev.stopPropagation()} onKeyDown={(ev) => ev.stopPropagation()}>
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
          <div onPointerDown={(ev) => ev.stopPropagation()}>
            {filters
              .filter((filter) => filter.type)
              .map((filter, index) => (
                <Fragment key={filter.type}>
                  {index > 0 && <hr className="slds-m-vertical_small" />}
                  <div>{getFilter(filter, index === 0)}</div>
                </Fragment>
              ))}
          </div>
        }
        buttonProps={{
          className: 'slds-button slds-button_icon',
          // Icon-only trigger needs an accessible name; the active state is conveyed in text (not color
          // alone) so screen-reader users can tell a filter is applied.
          'aria-label': `Filter${columnName ? ` ${columnName}` : ''}${active ? ' (active)' : ''}`,
          onClick: (ev) => ev.stopPropagation(),
        }}
      >
        <Icon
          type="utility"
          icon="filterList"
          className={classNames('slds-button__icon slds-icon_x-small', {
            'slds-text-color_brand': active,
            'slds-icon-text-default': !active,
          })}
        />
      </Popover>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Text
// ─────────────────────────────────────────────────────────────────────────────

interface HeaderTextFilterProps {
  columnKey: string;
  filter: DataTableTextFilter;
  autoFocus?: boolean;
  updateFilter: UpdateFilterFn;
}

export const HeaderTextFilter = memo(({ columnKey, filter, autoFocus = false, updateFilter }: HeaderTextFilterProps) => {
  const [value, setValue] = useState(filter.value);
  const debouncedValue = useDebounce(value, 300);
  // Hold the latest filter in a ref so the effect only re-fires when the debounced text value changes —
  // not whenever the parent rebuilds the filters map and hands us a new `filter` object identity.
  const filterRef = useRef(filter);
  filterRef.current = filter;

  useEffect(() => {
    const currentFilter = filterRef.current;
    if (currentFilter.value !== debouncedValue) {
      updateFilter(columnKey, { ...currentFilter, value: debouncedValue });
    }
  }, [updateFilter, debouncedValue, columnKey]);

  return (
    <Input id={`filter-${columnKey}`} className="slds-grow" label="Contains" clearButton={!!value} onClear={() => setValue('')}>
      <input
        id={`filter-${columnKey}`}
        className="slds-input"
        value={value}
        onChange={(ev) => setValue(ev.target.value)}
        autoFocus={autoFocus}
      />
    </Input>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Number (previously unimplemented)
// ─────────────────────────────────────────────────────────────────────────────

interface HeaderNumberFilterProps {
  columnKey: string;
  filter: DataTableNumberFilter;
  autoFocus?: boolean;
  updateFilter: UpdateFilterFn;
}

export const HeaderNumberFilter = memo(({ columnKey, filter, autoFocus = false, updateFilter }: HeaderNumberFilterProps) => {
  const [value, setValue] = useState(filter.value ?? '');
  const debouncedValue = useDebounce(value, 300);
  const [selectedComparator, setSelectedComparator] = useState<Comparator>(filter.comparator);
  // See HeaderTextFilter — scope the effect to the debounced value, not the `filter` object identity.
  const filterRef = useRef(filter);
  filterRef.current = filter;

  useEffect(() => {
    const nextValue = debouncedValue === '' ? null : debouncedValue;
    const currentFilter = filterRef.current;
    if (currentFilter.value !== nextValue) {
      updateFilter(columnKey, { ...currentFilter, value: nextValue });
    }
  }, [updateFilter, debouncedValue, columnKey]);

  function handleComparatorChange(comparator: Comparator) {
    setSelectedComparator(comparator);
    if (filter.comparator !== comparator) {
      updateFilter(columnKey, { ...filter, comparator });
    }
  }

  return (
    <div>
      <Picklist
        label="Comparison"
        items={COMPARATOR_ITEMS}
        selectedItemIds={[selectedComparator]}
        allowDeselection={false}
        onChange={(items: ListItem<string, any>[]) => handleComparatorChange(items[0].value as Comparator)}
      />
      <Input
        id={`filter-${columnKey}`}
        className="slds-grow slds-m-top_small"
        label="Value"
        clearButton={value !== ''}
        onClear={() => setValue('')}
      >
        <input
          id={`filter-${columnKey}`}
          type="number"
          className="slds-input"
          value={value ?? ''}
          onChange={(ev) => setValue(ev.target.value)}
          autoFocus={autoFocus}
        />
      </Input>
    </div>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// Set / Boolean Set (virtualized searchable checkbox list)
// ─────────────────────────────────────────────────────────────────────────────

interface HeaderSetFilterProps {
  columnKey: string;
  filter: DataTableSetFilter | DataTableBooleanSetFilter;
  values: string[];
  updateFilter: UpdateFilterFn;
}

export const HeaderSetFilter = memo(({ columnKey, filter, values, updateFilter }: HeaderSetFilterProps) => {
  const parentRef = useRef<HTMLDivElement>(null);
  const [selectedValues, setSelectedValues] = useState(() => new Set<string>(filter.value));
  const [visibleItems, setVisibleItems] = useState(values);
  const [searchTerm, setSearchTerm] = useState('');
  const [allItemsSelected, setAllItemsSelected] = useState(true);
  const [indeterminate, setIndeterminate] = useState(false);

  useEffect(() => {
    setVisibleItems(searchTerm ? values.filter(multiWordStringFilter(searchTerm)) : values);
  }, [searchTerm, values]);

  useEffect(() => {
    const everySelected = visibleItems.every((item) => selectedValues.has(item));
    setIndeterminate(!everySelected && visibleItems.some((item) => selectedValues.has(item)));
    setAllItemsSelected(everySelected);
  }, [selectedValues, visibleItems]);

  const rowVirtualizer = useVirtualizer({
    count: visibleItems.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 20.33,
    overscan: 50,
  });

  function handleSelectAll(checked: boolean) {
    const newSet = new Set(selectedValues);
    visibleItems.forEach((item) => (checked ? newSet.add(item) : newSet.delete(item)));
    setSelectedValues(newSet);
    updateFilter(columnKey, { ...filter, value: Array.from(newSet) });
  }

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
            checkboxClassName="slds-p-left_xx-small"
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
                    checkboxClassName="slds-truncate white-space-nowrap slds-p-left_xx-small"
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

// ─────────────────────────────────────────────────────────────────────────────
// Date / Time
// ─────────────────────────────────────────────────────────────────────────────

interface HeaderDateFilterProps {
  columnKey: string;
  filter: DataTableDateFilter;
  updateFilter: UpdateFilterFn;
}

export const HeaderDateFilter = memo(({ columnKey, filter, updateFilter }: HeaderDateFilterProps) => {
  const [value, setValue] = useState(() => (filter.value ? parseISO(filter.value) : null));
  const [selectedComparator, setSelectedComparator] = useState<Comparator>(() => filter.comparator);

  function handleComparatorChange(comparator: Comparator) {
    setSelectedComparator(comparator);
    if (filter.comparator !== comparator) {
      updateFilter(columnKey, { ...filter, comparator });
    }
  }

  function handleDateChange(nextValue: Date | null) {
    setValue(nextValue);
    updateFilter(columnKey, { ...filter, value: nextValue ? formatISO(nextValue) : null });
  }

  return (
    <div>
      <Picklist
        label="Comparison"
        items={COMPARATOR_ITEMS}
        selectedItemIds={[selectedComparator]}
        allowDeselection={false}
        onChange={(items: ListItem<string, any>[]) => handleComparatorChange(items[0].value as Comparator)}
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
  updateFilter: UpdateFilterFn;
}

export const HeaderTimeFilter = memo(({ columnKey, filter, updateFilter }: HeaderTimeFilterProps) => {
  const [value, setValue] = useState(() => filter.value);
  const [selectedComparator, setSelectedComparator] = useState<Comparator>(() => filter.comparator);

  function handleComparatorChange(comparator: Comparator) {
    setSelectedComparator(comparator);
    if (filter.comparator !== comparator) {
      updateFilter(columnKey, { ...filter, comparator });
    }
  }

  function handleTimeChange(nextValue: string | null) {
    const normalizedValue = nextValue ?? '';
    setValue(normalizedValue);
    updateFilter(columnKey, { ...filter, value: normalizedValue });
  }

  return (
    <div>
      <Picklist
        label="Comparison"
        items={COMPARATOR_ITEMS}
        selectedItemIds={[selectedComparator]}
        allowDeselection={false}
        onChange={(items: ListItem<string, any>[]) => handleComparatorChange(items[0].value as Comparator)}
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
