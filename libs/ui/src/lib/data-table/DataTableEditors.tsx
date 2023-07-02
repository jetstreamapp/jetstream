import { css } from '@emotion/react';
import { ListItem } from '@jetstream/types';
import formatISO from 'date-fns/formatISO';
import parseISO from 'date-fns/parseISO';
import { useRef, useState } from 'react';
import { RenderEditCellProps } from 'react-data-grid';
import DatePicker from '../form/date/DatePicker';
import Input from '../form/input/Input';
import { getRowId } from './data-table-utils';

function autoFocusAndSelect(input: HTMLInputElement | null) {
  input?.focus();
  input?.select();
}

export function DataTableEditorText<TRow, TSummaryRow>({ row, column, onRowChange, onClose }: RenderEditCellProps<TRow, TSummaryRow>) {
  return (
    <Input>
      <input
        css={css`
          color: #000;
          width: 100%;
        `}
        ref={autoFocusAndSelect}
        value={(row[column.key as keyof TRow] as unknown as string) || ''}
        onChange={(event) => {
          const _touchedColumns = new Set((row as any)._touchedColumns || []);
          _touchedColumns.add(column.key);
          onRowChange({ ...row, [column.key]: event.target.value, _touchedColumns });
        }}
        onBlur={() => {
          onClose(true, true);
        }}
      />
    </Input>
  );
}

export function DataTableEditorBoolean<TRow, TSummaryRow>({ row, column, onRowChange, onClose }: RenderEditCellProps<TRow, TSummaryRow>) {
  const value = (row[column.key as keyof TRow] as unknown as boolean) || false;
  const id = `${getRowId(row)}_${column.key}_checkbox`;
  return (
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
              onClose(true, true);
            }}
          />
          <span className="slds-checkbox_faux"></span>
        </div>
      </div>
    </div>
  );
}

export function dataTableEditorDropdownWrapper<TRow, TSummaryRow>({ values: _values }: { values: ListItem[] }) {
  return ({ row, column, onRowChange, onClose }: RenderEditCellProps<TRow, TSummaryRow>) => {
    const allValues = useRef(new Set(_values.map((v) => v.value)));
    const [values, setValues] = useState<ListItem[]>(_values);

    const currValue = row[column.key as keyof TRow] as unknown as string;
    // make sure inactive value (if selected) shows up as an option in the dropdown
    if (currValue && !allValues.current.has(currValue)) {
      allValues.current.add(currValue);
      setValues([...values, { id: currValue, label: currValue, value: currValue }]);
    }

    return (
      <select
        css={css`
          color: #000;
          width: 100%;
          height: calc(1.5rem + (1px * 2));
        `}
        className="slds-select"
        value={(row[column.key as keyof TRow] as unknown as string) || ''}
        onChange={(event) => {
          const _touchedColumns = new Set((row as any)._touchedColumns || []);
          _touchedColumns.add(column.key);
          onRowChange({ ...row, [column.key]: event.target.value, _touchedColumns }, true);
        }}
        autoFocus
      >
        {values.map((value) => (
          <option key={value.id} value={value.value}>
            {value.label}
          </option>
        ))}
      </select>
    );
  };
}

export function DataTableEditorDate<TRow, TSummaryRow>({ row, column, onRowChange, onClose }: RenderEditCellProps<TRow, TSummaryRow>) {
  const currValue = row[column.key as keyof TRow] as unknown as string;
  let currDate: Date | undefined;
  if (currValue) {
    currDate = parseISO(currValue);
  }

  return (
    <DatePicker
      css={css`
        input {
          min-height: calc(1.5rem + (1px * 2));
          max-height: calc(1.5rem + (1px * 2));
        }
      `}
      label="Edit Date"
      hideLabel
      usePortal
      containerDisplay="contents"
      initialSelectedDate={currDate}
      onChange={(value) => {
        const _touchedColumns = new Set((row as any)._touchedColumns || []);
        _touchedColumns.add(column.key);
        onRowChange({ ...row, [column.key]: value ? formatISO(value, { representation: 'date' }) : null, _touchedColumns }, true);
      }}
    />
  );
}
