import { logger } from '@jetstream/shared/client-logger';
import { SFDC_BLANK_PICKLIST_VALUE } from '@jetstream/shared/constants';
import { describeSObject, query } from '@jetstream/shared/data';
import { isEnterKey, isEscapeKey } from '@jetstream/shared/ui-utils';
import { ListItem, SalesforceOrgUi } from '@jetstream/types';
import { formatISO } from 'date-fns/formatISO';
import { parseISO } from 'date-fns/parseISO';
import isNil from 'lodash/isNil';
import isString from 'lodash/isString';
import { ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { RenderEditCellProps } from 'react-data-grid';
import ComboboxWithItems from '../form/combobox/ComboboxWithItems';
import ComboboxWithItemsTypeAhead from '../form/combobox/ComboboxWithItemsTypeAhead';
import DatePicker from '../form/date/DatePicker';
import Input from '../form/input/Input';
import Picklist from '../form/picklist/Picklist';
import PopoverContainer from '../popover/PopoverContainer';
import Tabs from '../tabs/Tabs';
import OutsideClickHandler from '../utils/OutsideClickHandler';
import { DataTableGenericContext } from './data-table-context';
import { getRowId } from './data-table-utils';

function autoFocusAndSelect(input: HTMLInputElement | null) {
  input?.focus();
  input?.select();
}

function DataTableEditorPopover({
  rowIdx,
  colIdx,
  onClose,
  children,
}: {
  rowIdx: number;
  colIdx: number;
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
    <OutsideClickHandler additionalParentRef={popoverRef.current} onOutsideClick={() => onClose()}>
      <PopoverContainer
        ref={popoverRef}
        isOpen
        referenceElement={referenceElement as any}
        className={`slds-popover slds-popover slds-popover_edit`}
        role="dialog"
        offset={[0, -28.5]}
        usePortal
        onKeyDown={(event) => {
          if (isEscapeKey(event)) {
            onClose();
          }
        }}
      >
        {referenceElement && <div className="slds-p-around_x-small">{children}</div>}
      </PopoverContainer>
    </OutsideClickHandler>
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
      <Input hideLabel label={`Edit ${isString(column.name) ? column.name : column.key}`}>
        <input
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

export function dataTableEditorDropdownWrapper<TRow extends { _idx: number }, TSummaryRow>({
  values: _values,
  isMultiSelect,
}: {
  values: ListItem[];
  isMultiSelect: boolean;
}) {
  return ({ row, column, onRowChange, onClose }: RenderEditCellProps<TRow, TSummaryRow>) => {
    const allValues = useRef(new Set(_values.map((v) => v.value)));
    const [values, setValues] = useState<ListItem[]>(_values);

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
              onRowChange({ ...row, [column.key]: (items || []).map((item) => item.value).join(';'), _touchedColumns }, false);
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
            onRowChange({ ...row, [column.key]: item.value, _touchedColumns }, true);
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

type Tab = 'lookup' | 'text';

export const dataTableEditorRecordLookup = ({ sobject }: { sobject: string }) => {
  return function DataTableEditorRecordLookup<TRow extends { _idx: number }, TSummaryRow>({
    row,
    column,
    onRowChange,
    onClose,
  }: RenderEditCellProps<TRow, TSummaryRow>) {
    const currValue = row[column.key as keyof TRow] as unknown as string;
    const { org } = useContext(DataTableGenericContext) as { org: SalesforceOrgUi; defaultApiVersion: string };
    const nameField = useRef<{ sobject: string; nameField: string }>();
    const [records, setRecords] = useState<ListItem<string, any>[]>([]);
    const [selectedRecord, setSelectedRecords] = useState<ListItem<string, any> | null>(null);
    const [activeTab, setActiveTab] = useState<Tab>('text');

    const handleSearch = useCallback(
      async (searchTerm: string) => {
        searchTerm = (searchTerm || '').trim();
        logger.log('search', searchTerm);
        setSelectedRecords(null);
        try {
          if (!sobject) {
            setRecords([]);
            return;
          }
          if (!nameField.current || nameField.current.sobject !== sobject) {
            nameField.current = {
              sobject,
              nameField: await describeSObject(org, sobject).then(
                (result) => result.data.fields.find((field) => field.nameField)?.name || 'Name'
              ),
            };
          }
          const name = nameField.current.nameField;

          let soql = `SELECT Id, ${name} FROM ${sobject} ORDER BY ${name} LIMIT 50`;
          if (searchTerm) {
            if (searchTerm.length === 15 || searchTerm.length === 18) {
              soql = `SELECT Id, ${name} FROM ${sobject} WHERE Id = '${searchTerm}' OR ${name} LIKE '%${searchTerm}%' ORDER BY ${name} LIMIT 50`;
            } else {
              soql = `SELECT Id, ${name} FROM ${sobject} WHERE ${name} LIKE '%${searchTerm}%' ORDER BY ${name} LIMIT 50`;
            }
          }
          const { queryResults } = await query(org, soql);
          setRecords([
            {
              id: '',
              label: SFDC_BLANK_PICKLIST_VALUE,
              value: '',
            },
            ...queryResults.records.map((record) => ({
              id: record.Id,
              label: record[name],
              secondaryLabel: record.Id,
              secondaryLabelOnNewLine: true,
              value: record.Id,
            })),
          ]);
        } catch (ex) {
          logger.warn('Error searching records', ex);
          setRecords([]);
        }
      },
      [org]
    );

    if (!org || !sobject) {
      return <DataTableEditorText column={column} onClose={onClose} onRowChange={onRowChange} row={row} />;
    }

    return (
      <DataTableEditorPopover rowIdx={row._idx} colIdx={column.idx} onClose={onClose}>
        <Tabs
          initialActiveId={activeTab}
          contentClassname="slds-p-bottom_none"
          onChange={(value: Tab) => {
            setActiveTab(value);
          }}
          tabs={[
            {
              id: 'text',
              title: 'Text',
              content: (
                <Input hideLabel label={`Edit ${isString(column.name) ? column.name : column.key}`}>
                  <input
                    className="slds-input"
                    ref={autoFocusAndSelect}
                    value={(row[column.key as keyof TRow] as unknown as string) || ''}
                    onChange={(event) => {
                      const _touchedColumns = new Set((row as any)._touchedColumns || []);
                      _touchedColumns.add(column.key);
                      onRowChange({ ...row, [column.key]: event.target.value, _touchedColumns });
                    }}
                    onKeyDown={(event) => {
                      if (isEnterKey(event)) {
                        onClose(true);
                      }
                    }}
                  />
                </Input>
              ),
            },
            {
              id: 'lookup',
              title: 'Lookup Search',
              content: (
                <ComboboxWithItemsTypeAhead
                  comboboxProps={{
                    label: `Edit ${isString(column.name) ? column.name : column.key}`,
                    hideLabel: true,
                    className: 'w-100',
                    placeholder: sobject ? `Search ${sobject} by name or id` : 'select an object',
                  }}
                  items={records}
                  onSearch={handleSearch}
                  selectedItemId={selectedRecord?.id || currValue}
                  onSelected={(item) => {
                    const _touchedColumns = new Set((row as any)._touchedColumns || []);
                    _touchedColumns.add(column.key);
                    onRowChange({ ...row, [column.key]: item?.value || null, _touchedColumns }, !isNil(item?.value));
                  }}
                />
              ),
            },
          ]}
        />
      </DataTableEditorPopover>
    );
  };
};
