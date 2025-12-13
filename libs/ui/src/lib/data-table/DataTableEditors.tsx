/* eslint-disable @typescript-eslint/no-explicit-any */
import { logger } from '@jetstream/shared/client-logger';
import { isEscapeKey } from '@jetstream/shared/ui-utils';
import { ListItem, SalesforceOrgUi } from '@jetstream/types';
import { formatISO } from 'date-fns/formatISO';
import { parseISO } from 'date-fns/parseISO';
import isNil from 'lodash/isNil';
import isString from 'lodash/isString';
import { ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { RenderEditCellProps } from 'react-data-grid';
import ComboboxWithItems from '../form/combobox/ComboboxWithItems';
import { RecordLookupCombobox } from '../form/combobox/RecordLookupCombobox';
import DatePicker from '../form/date/DatePicker';
import Input from '../form/input/Input';
import Picklist from '../form/picklist/Picklist';
import PopoverContainer, { PopoverContainerProps } from '../popover/PopoverContainer';
import { DataTableGenericContext } from './data-table-context';
import { getRowId } from './data-table-utils';

function autoFocusAndSelect(input: HTMLInputElement | null) {
  input?.focus();
  input?.select();
}

function DataTableEditorPopover({
  rowIdx,
  colIdx,
  popoverContainerProps,
  onClose,
  children,
}: {
  rowIdx: number;
  colIdx: number;
  popoverContainerProps?: Omit<PopoverContainerProps, 'className' | 'isOpen' | 'referenceElement' | 'usePortal' | 'isEager' | 'children'>;
  onClose: (commitChanges?: boolean, shouldFocusCell?: boolean) => void;
  children: ReactNode;
}) {
  const { rows } = useContext(DataTableGenericContext) as { rows: { _idx: number }[] };
  const popoverRef = useRef<HTMLDivElement | null>(null);
  /** This is not set on initial render because the date picker is open on render and the reference element must exist to render correctly */
  const [referenceElement, setReferenceElement] = useState<Element | null>(null);

  useEffect(() => {
    try {
      // If rows are filtered, the provided index will not be accurate
      const actualRowIdx = !rows || rows[rowIdx]?._idx === rowIdx ? rowIdx : rows.findIndex(({ _idx }) => _idx === rowIdx);
      if ((actualRowIdx ?? -1) >= 0) {
        setReferenceElement(document.querySelector(`[aria-rowindex="${actualRowIdx + 2}"] > [aria-colindex="${colIdx + 1}"]`));
      }
    } catch (ex) {
      logger.warn('Error setting reference element', ex);
    }
  }, [colIdx, rowIdx, rows]);

  return (
    <PopoverContainer
      ref={popoverRef}
      isOpen
      referenceElement={referenceElement as any}
      className="slds-popover slds-popover slds-popover_edit"
      role="dialog"
      // offset={[0, -28.5]}
      usePortal
      {...popoverContainerProps}
      onKeyDown={(event) => {
        if (isEscapeKey(event)) {
          onClose();
        }
      }}
    >
      {referenceElement && <div className="slds-p-around_x-small">{children}</div>}
    </PopoverContainer>
  );
}

export function DataTableEditorText<TRow extends { _idx: number }, TSummaryRow>({
  row,
  column,
  onRowChange,
  onClose,
}: RenderEditCellProps<TRow, TSummaryRow>) {
  return (
    <DataTableEditorPopover rowIdx={row._idx} colIdx={column.idx} onClose={onClose}>
      <Input id={`edit-${column.key}`} hideLabel label={`Edit ${isString(column.name) ? column.name : column.key}`}>
        <input
          id={`edit-${column.key}`}
          className="slds-input"
          ref={autoFocusAndSelect}
          value={(row[column.key as keyof TRow] as unknown as string) || ''}
          onChange={(event) => {
            const _touchedColumns = new Set((row as any)._touchedColumns || []);
            _touchedColumns.add(column.key);
            onRowChange({ ...row, [column.key]: event.target.value, _touchedColumns });
          }}
          onBlur={() => {
            onClose(true);
          }}
        />
      </Input>
    </DataTableEditorPopover>
  );
}

export function DataTableEditorBoolean<TRow extends { _idx: number }, TSummaryRow>({
  row,
  column,
  onRowChange,
  onClose,
}: RenderEditCellProps<TRow, TSummaryRow>) {
  const value = (row[column.key as keyof TRow] as unknown as boolean) || false;
  const id = `${getRowId(row)}_${column.key}_checkbox`;
  return (
    <DataTableEditorPopover rowIdx={row._idx} colIdx={column.idx} onClose={onClose}>
      <div className="slds-form-element slds-align_absolute-center slds-m-top_x-small">
        <label className="slds-form-element__label slds-assistive-text" htmlFor={id}>
          Edit {column.name}
        </label>
        <div className="slds-form-element__control">
          <div className="slds-checkbox slds-checkbox_standalone">
            <input
              id={id}
              type="checkbox"
              name="options"
              checked={value}
              onChange={(event) => {
                const _touchedColumns = new Set((row as any)._touchedColumns || []);
                _touchedColumns.add(column.key);
                onRowChange({ ...row, [column.key]: event.target.checked, _touchedColumns });
              }}
              onBlur={() => {
                onClose(true);
              }}
            />
            <span className="slds-checkbox_faux"></span>
          </div>
        </div>
      </div>
    </DataTableEditorPopover>
  );
}

const BLANK_LIST_ITEM: ListItem = { id: '_BLANK_', label: '--None--', value: '' };

export function dataTableEditorDropdownWrapper<TRow extends { _idx: number }, TSummaryRow>({
  values: _values,
  isMultiSelect,
}: {
  values: ListItem[];
  isMultiSelect: boolean;
}) {
  return ({ row, column, onRowChange, onClose }: RenderEditCellProps<TRow, TSummaryRow>) => {
    const allValues = useRef(new Set([BLANK_LIST_ITEM.value, ..._values.map((v) => v.value)]));
    const [values, setValues] = useState<ListItem[]>(() => [BLANK_LIST_ITEM, ..._values]);

    const selectedItemId = row[column.key as keyof TRow] as unknown as string;
    // only used if multi-select is enabled

    // make sure inactive value (if selected) shows up as an option in the dropdown
    // only runs on first render
    useEffect(() => {
      if (isMultiSelect) {
        const selectedItemIds = selectedItemId ? selectedItemId.split(';') : [];
        if (selectedItemIds.length) {
          const missingItems = selectedItemIds
            .filter((itemId) => !allValues.current.has(itemId))
            .map((itemId) => {
              allValues.current.add(itemId);
              return itemId;
            });
          setValues([...values, ...missingItems.map((itemId) => ({ id: itemId, label: itemId, value: itemId }))]);
        }
      } else {
        if (selectedItemId && !allValues.current.has(selectedItemId)) {
          allValues.current.add(selectedItemId);
          setValues([...values, { id: selectedItemId, label: selectedItemId, value: selectedItemId }]);
        }
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (isMultiSelect) {
      const selectedItemIds = selectedItemId ? selectedItemId.split(';') : [];
      return (
        <DataTableEditorPopover rowIdx={row._idx} colIdx={column.idx} onClose={onClose}>
          <Picklist
            label={`Edit ${isString(column.name) ? column.name : column.key}`}
            hideLabel
            items={values}
            selectedItemIds={selectedItemIds}
            multiSelection
            omitMultiSelectPills
            scrollLength={10}
            onClose={() => {
              onClose(true);
            }}
            onChange={(items) => {
              const _touchedColumns = new Set((row as any)._touchedColumns || []);
              _touchedColumns.add(column.key);
              onRowChange(
                {
                  ...row,
                  [column.key]: (items || [])
                    .map((item) => item.value)
                    .filter(Boolean)
                    .join(';'),
                  _touchedColumns,
                },
                false,
              );
            }}
          />
        </DataTableEditorPopover>
      );
    }

    return (
      <DataTableEditorPopover rowIdx={row._idx} colIdx={column.idx} onClose={onClose}>
        <ComboboxWithItems
          comboboxProps={{
            label: `Edit ${isString(column.name) ? column.name : column.key}`,
            hideLabel: true,
            itemLength: 10,
            inputProps: {
              autoFocus: true,
            },
          }}
          items={values}
          selectedItemId={selectedItemId}
          onSelected={(item) => {
            const _touchedColumns = new Set((row as any)._touchedColumns || []);
            _touchedColumns.add(column.key);
            onRowChange({ ...row, [column.key]: item.value === '' ? null : item.value, _touchedColumns }, true);
          }}
        />
      </DataTableEditorPopover>
    );
  };
}

export function DataTableEditorDate<TRow extends { _idx: number }, TSummaryRow>({
  row,
  column,
  onRowChange,
  onClose,
}: RenderEditCellProps<TRow, TSummaryRow>) {
  const currValue = row[column.key as keyof TRow] as unknown as string;
  let currDate: Date | undefined;
  if (currValue) {
    currDate = parseISO(currValue);
  }

  return (
    <DataTableEditorPopover rowIdx={row._idx} colIdx={column.idx} onClose={onClose}>
      <DatePicker
        label={`Edit ${isString(column.name) ? column.name : column.key}`}
        hideLabel
        containerDisplay="contents"
        className="d-block"
        initialSelectedDate={currDate}
        openOnInit
        inputProps={{ autoFocus: true }}
        trigger="onBlur"
        onChange={(value) => {
          /** setTimeout is used to avoid a React error about flushSync being called during a render */
          setTimeout(() => {
            const _touchedColumns = new Set((row as any)._touchedColumns || []);
            _touchedColumns.add(column.key);
            onRowChange({ ...row, [column.key]: value ? formatISO(value, { representation: 'date' }) : null, _touchedColumns }, true);
          });
        }}
      />
    </DataTableEditorPopover>
  );
}

export const dataTableEditorRecordLookup = ({ sobjects }: { sobjects: string[] }) => {
  return function DataTableEditorRecordLookup<TRow extends { _idx: number }, TSummaryRow>({
    row,
    column,
    onRowChange,
    onClose,
  }: RenderEditCellProps<TRow, TSummaryRow>) {
    const currValue = row[column.key as keyof TRow] as unknown as string;
    const { org } = useContext(DataTableGenericContext) as { org: SalesforceOrgUi; defaultApiVersion: string };
    const [selectedSobject, setSelectedSobject] = useState(sobjects[0]);

    if (!org || !selectedSobject) {
      return <DataTableEditorText rowIdx={row._idx} column={column} onClose={onClose} onRowChange={onRowChange} row={row} />;
    }

    return (
      <DataTableEditorPopover
        rowIdx={row._idx}
        colIdx={column.idx}
        onClose={onClose}
        popoverContainerProps={{ minWidth: '25rem', maxWidth: '25rem' }}
      >
        <RecordLookupCombobox
          org={org}
          sobjects={sobjects}
          allowManualMode
          comboboxProps={{
            label: `Edit ${isString(column.name) ? column.name : column.key}`,
            hideLabel: true,
            className: 'w-100',
            placeholder: selectedSobject ? `Search ${selectedSobject} by name or id` : 'select an object',
          }}
          value={currValue}
          onChange={(value) => {
            const _touchedColumns = new Set((row as any)._touchedColumns || []);
            _touchedColumns.add(column.key);
            onRowChange({ ...row, [column.key]: value || null, _touchedColumns }, !isNil(value));
          }}
          onObjectChange={setSelectedSobject}
        />
      </DataTableEditorPopover>
    );
  };
};
