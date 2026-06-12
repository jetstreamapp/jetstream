/* eslint-disable @typescript-eslint/no-explicit-any */
import { ListItem, SalesforceOrgUi } from '@jetstream/types';
import { formatISO } from 'date-fns/formatISO';
import { parseISO } from 'date-fns/parseISO';
import isString from 'lodash/isString';
import { useContext, useEffect, useRef, useState } from 'react';
import ComboboxWithItems from '../../../form/combobox/ComboboxWithItems';
import { RecordLookupCombobox } from '../../../form/combobox/RecordLookupCombobox';
import DatePicker from '../../../form/date/DatePicker';
import Input from '../../../form/input/Input';
import Picklist from '../../../form/picklist/Picklist';
import { GridGenericContext } from '../grid-context';
import { DataTableEditorProps } from '../grid-types';

/**
 * Inline cell editors, ported to the new `DataTableEditorProps` contract. Each returns just the edit
 * control — the popover chrome + positioning is provided by EditorHost (floating-ui anchored to the
 * live cell), replacing the legacy `aria-rowindex`/`aria-colindex` DOM-query positioning.
 */

function autoFocusAndSelect(input: HTMLInputElement | null) {
  input?.focus();
  input?.select();
}

function withTouched<TRow>(row: TRow, columnKey: string): Set<string> {
  const touched = new Set<string>((row as any)._touchedColumns || []);
  touched.add(columnKey);
  return touched;
}

function editLabel(column: { name: unknown; key: string }): string {
  return `Edit ${isString(column.name) ? column.name : column.key}`;
}

export function EditorText<TRow>({ row, column, onRowChange, onClose }: DataTableEditorProps<TRow>) {
  return (
    <Input id={`edit-${column.key}`} hideLabel label={editLabel(column)}>
      <input
        id={`edit-${column.key}`}
        className="slds-input"
        ref={autoFocusAndSelect}
        autoFocus
        value={((row as any)[column.key] as string) || ''}
        onChange={(event) => onRowChange({ ...row, [column.key]: event.target.value, _touchedColumns: withTouched(row, column.key) })}
        onBlur={() => onClose(true, true)}
      />
    </Input>
  );
}

export function EditorBoolean<TRow>({ row, column, onRowChange, onClose }: DataTableEditorProps<TRow>) {
  const value = ((row as any)[column.key] as boolean) || false;
  const id = `edit-${column.key}-checkbox`;
  return (
    <div className="slds-form-element slds-align_absolute-center slds-m-top_x-small">
      <label className="slds-form-element__label slds-assistive-text" htmlFor={id}>
        {editLabel(column)}
      </label>
      <div className="slds-form-element__control">
        <div className="slds-checkbox slds-checkbox_standalone">
          <input
            id={id}
            type="checkbox"
            checked={value}
            autoFocus
            onChange={(event) => onRowChange({ ...row, [column.key]: event.target.checked, _touchedColumns: withTouched(row, column.key) })}
            onBlur={() => onClose(true, true)}
          />
          <span className="slds-checkbox_faux"></span>
        </div>
      </div>
    </div>
  );
}

export function EditorDate<TRow>({ row, column, onRowChange, onClose }: DataTableEditorProps<TRow>) {
  const currentValue = (row as any)[column.key] as string;
  const currentDate = currentValue ? parseISO(currentValue) : undefined;
  return (
    <DatePicker
      label={editLabel(column)}
      hideLabel
      containerDisplay="contents"
      className="d-block"
      initialSelectedDate={currentDate}
      openOnInit
      inputProps={{ autoFocus: true }}
      trigger="onBlur"
      onChange={(value) => {
        // setTimeout avoids a React flushSync-during-render warning from the date picker.
        setTimeout(() => {
          onRowChange(
            { ...row, [column.key]: value ? formatISO(value, { representation: 'date' }) : null, _touchedColumns: withTouched(row, column.key) },
            true,
          );
        });
      }}
    />
  );
}

const BLANK_LIST_ITEM: ListItem = { id: '_BLANK_', label: '--None--', value: '' };

export function editorDropdown<TRow>({ values: providedValues, isMultiSelect }: { values: ListItem[]; isMultiSelect: boolean }) {
  return function EditorDropdown({ row, column, onRowChange, onClose }: DataTableEditorProps<TRow>) {
    const allValues = useRef(new Set([BLANK_LIST_ITEM.value, ...providedValues.map((item) => item.value)]));
    const [values, setValues] = useState<ListItem[]>(() => [BLANK_LIST_ITEM, ...providedValues]);
    const selectedItemId = (row as any)[column.key] as string;

    // Ensure an inactive/selected value still shows as an option (runs once).
    useEffect(() => {
      if (isMultiSelect) {
        const selectedItemIds = selectedItemId ? selectedItemId.split(';') : [];
        const missingItems = selectedItemIds.filter((itemId) => !allValues.current.has(itemId));
        if (missingItems.length) {
          missingItems.forEach((itemId) => allValues.current.add(itemId));
          setValues((prev) => [...prev, ...missingItems.map((itemId) => ({ id: itemId, label: itemId, value: itemId }))]);
        }
      } else if (selectedItemId && !allValues.current.has(selectedItemId)) {
        allValues.current.add(selectedItemId);
        setValues((prev) => [...prev, { id: selectedItemId, label: selectedItemId, value: selectedItemId }]);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (isMultiSelect) {
      const selectedItemIds = selectedItemId ? selectedItemId.split(';') : [];
      return (
        <Picklist
          label={editLabel(column)}
          hideLabel
          items={values}
          selectedItemIds={selectedItemIds}
          multiSelection
          omitMultiSelectPills
          scrollLength={10}
          inputProps={{ autoFocus: true }}
          onClose={() => onClose(true, true)}
          onChange={(items) =>
            onRowChange(
              {
                ...row,
                [column.key]: (items || [])
                  .map((item) => item.value)
                  .filter(Boolean)
                  .join(';'),
                _touchedColumns: withTouched(row, column.key),
              },
              false,
            )
          }
        />
      );
    }

    return (
      <ComboboxWithItems
        comboboxProps={{ label: editLabel(column), hideLabel: true, itemLength: 10, inputProps: { autoFocus: true } }}
        items={values}
        selectedItemId={selectedItemId}
        onSelected={(item) =>
          onRowChange({ ...row, [column.key]: item.value === '' ? null : item.value, _touchedColumns: withTouched(row, column.key) }, true)
        }
      />
    );
  };
}

export function editorRecordLookup<TRow>({ sobjects }: { sobjects: string[] }) {
  return function EditorRecordLookup(props: DataTableEditorProps<TRow>) {
    const { row, column, onRowChange } = props;
    const currentValue = (row as any)[column.key] as string;
    const { org } = useContext(GridGenericContext) as { org: SalesforceOrgUi };
    const [selectedSobject, setSelectedSobject] = useState(sobjects[0]);

    if (!org || !selectedSobject) {
      return <EditorText {...props} />;
    }

    return (
      <RecordLookupCombobox
        org={org}
        sobjects={sobjects}
        allowManualMode
        comboboxProps={{
          label: editLabel(column),
          hideLabel: true,
          className: 'w-100',
          placeholder: `Search ${selectedSobject} by name or id`,
          inputProps: { autoFocus: true },
        }}
        manualModeInputProps={{ autoFocus: true, placeholder: `Enter ${selectedSobject} Id` }}
        value={currentValue}
        onChange={(value) => onRowChange({ ...row, [column.key]: value || null, _touchedColumns: withTouched(row, column.key) }, false)}
        onObjectChange={setSelectedSobject}
      />
    );
  };
}
