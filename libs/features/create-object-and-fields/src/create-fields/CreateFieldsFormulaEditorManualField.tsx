import { ListItem } from '@jetstream/types';
import { Checkbox, ComboboxWithItems, DatePicker, DateTime, Grid, Input, TimePicker } from '@jetstream/ui';
import { FieldValue, ManualFormulaFieldType } from '@jetstream/ui-core';
import { formatISO } from 'date-fns/formatISO';
import { isValid } from 'date-fns/isValid';
import { parseISO } from 'date-fns/parseISO';
import isDate from 'lodash/isDate';
import { forwardRef } from 'react';

const FieldTypeItems: ListItem<ManualFormulaFieldType, ManualFormulaFieldType>[] = [
  { id: 'string', label: 'Text', value: 'string' },
  { id: 'double', label: 'Number', value: 'double' },
  { id: 'boolean', label: 'Checkbox', value: 'boolean' },
  { id: 'date', label: 'Date', value: 'date' },
  { id: 'datetime', label: 'Datetime', value: 'datetime' },
  { id: 'time', label: 'Time', value: 'time' },
];

function getNumericValue(value: FieldValue): string {
  if (typeof value === 'number') {
    return String(value);
  }
  if (value === '-') {
    return value;
  }
  if (typeof value === 'string') {
    const currValue = parseFloat(value);
    return isNaN(currValue) ? '' : String(currValue);
  }
  return '';
}

function getDateValue(value: FieldValue): Date {
  if (typeof value === 'string') {
    const date = parseISO(value);
    return isValid(date) ? date : new Date();
  }
  return new Date();
}

export interface CreateFieldsFormulaEditorManualFieldProps {
  field: string;
  fieldType: ManualFormulaFieldType;
  fieldValue: FieldValue;
  disabled?: boolean;
  onChange: (type: ManualFormulaFieldType, value: FieldValue | null) => void;
}

export const CreateFieldsFormulaEditorManualField = forwardRef<unknown, CreateFieldsFormulaEditorManualFieldProps>(
  ({ field, fieldType, fieldValue, disabled, onChange }, ref) => {
    function handleTypeChange(item: ListItem<ManualFormulaFieldType, ManualFormulaFieldType>) {
      const value = fieldValue;
      const newType = item.value;
      if (newType === 'string') {
        onChange(newType, String(value));
      } else if (newType === 'double') {
        onChange(newType, getNumericValue(value));
      } else if (newType === 'boolean') {
        onChange(newType, !!value);
      } else if (newType === 'date') {
        onChange(newType, formatISO(getDateValue(value), { representation: 'date' }));
      } else if (newType === 'datetime') {
        onChange(newType, formatISO(getDateValue(value)));
      } else if (newType === 'time') {
        onChange(newType, String(value));
      } else {
        throw new Error(`Unknown type: ${newType}`);
      }
    }

    return (
      <>
        <p className="slds-text-heading_small slds-p-top_xx-small">{field}</p>
        <Grid verticalAlign="start" className="slds-p-left_xx-small">
          <ComboboxWithItems
            comboboxProps={{
              label: 'Field Type',
              itemLength: 7,
              disabled,
              className: 'slds-m-right_small',
            }}
            items={FieldTypeItems as ListItem[]}
            selectedItemId={fieldType}
            onSelected={(items) => handleTypeChange(items as unknown as ListItem<ManualFormulaFieldType, ManualFormulaFieldType>)}
          />
          {fieldType === 'string' && (
            <Input label="Value" className="w-100">
              <input
                className="slds-input"
                value={String(fieldValue)}
                onChange={(event) => onChange(fieldType, event.target.value)}
                disabled={disabled}
              />
            </Input>
          )}
          {fieldType === 'double' && (
            <Input label="Value" className="w-100">
              <input
                className="slds-input"
                value={getNumericValue(fieldValue)}
                onChange={(event) => onChange(fieldType, event.target.value)}
                disabled={disabled}
              />
            </Input>
          )}
          {fieldType === 'boolean' && (
            <Checkbox
              id={`field-${field}`}
              className="slds-p-top_large"
              label="Value"
              checked={!!fieldValue}
              disabled={disabled}
              onChange={(value) => onChange(fieldType, value)}
            />
          )}
          {fieldType === 'date' && (
            <DatePicker
              className="w-100"
              id={`datepicker-${field}`}
              label="Value"
              // className="w-100"
              initialSelectedDate={getDateValue(fieldValue)}
              onChange={(value) => onChange(fieldType, isDate(value) ? formatISO(value, { representation: 'date' }) : null)}
            />
          )}
          {fieldType === 'datetime' && (
            <DateTime
              initialDateValue={getDateValue(fieldValue)}
              dateProps={{
                id: `datepicker-${field}`,
                label: field,
                className: 'slds-form-element_stacked slds-is-editing',
                containerDisplay: 'contents',
                disabled: disabled,
              }}
              timeProps={{
                label: 'Time',
                className: 'slds-form-element_stacked slds-is-editing',
                stepInMinutes: 1,
                disabled: disabled,
              }}
              onChange={(value) => onChange(fieldType, isDate(value) ? formatISO(value) : null)}
            />
          )}
          {fieldType === 'time' && (
            <TimePicker
              id={`time-${field}`}
              label="Value"
              className="slds-form-element_stacked slds-is-editing"
              selectedItem={String(fieldValue)}
              disabled={disabled}
              stepInMinutes={1}
              onChange={(value) => onChange(fieldType, value)}
            />
          )}
        </Grid>
      </>
    );
  }
);

export default CreateFieldsFormulaEditorManualField;
