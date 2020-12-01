/* eslint-disable jsx-a11y/anchor-is-valid */
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { formatISO, parse as parseDate, parseISO } from 'date-fns';
import React, { FunctionComponent, useState } from 'react';
import DatePicker, { DatePickerProps } from '../date/DatePicker';
import { PicklistProps } from '../picklist/Picklist';
import TimePicker, { TimePickerProps } from '../time-picker/TimePicker';

export type PicklistPropsWithoutItems = Omit<
  PicklistProps,
  'items' | 'groups' | 'selectedItems' | 'selectedItemIds' | 'multiSelection' | 'omitMultiSelectPills' | 'onChange'
>;

export interface DateTimeProps {
  legendLabel?: string;
  dateProps: Omit<DatePickerProps, 'onChange'>;
  timeProps: Omit<TimePickerProps, 'onChange'>;
  initialValue?: string;
  // ISO8601 date string
  onChange: (date: string) => void;
}

export const DateTime: FunctionComponent<DateTimeProps> = ({ legendLabel, dateProps, timeProps, initialValue, onChange }) => {
  const [value, setValue] = useState(initialValue);
  const [datePickerValue, setDatePickerValue] = useState<string>(null);
  const [timeValue, setTimeValue] = useState<string>(null);

  useNonInitialEffect(() => {
    let newValue = null;
    if (datePickerValue && timeValue) {
      // combine date and time into ISO8601
      newValue = formatISO(parseDate(timeValue, 'HH:mm:ss.SSS', parseISO(datePickerValue)));
    } else if (datePickerValue) {
      newValue = formatISO(parseISO(datePickerValue));
    } else if (timeValue) {
      newValue = formatISO(parseDate(timeValue, 'HH:mm:ss.SSS', new Date()));
    }
    if (value !== newValue) {
      setValue(newValue);
      onChange(newValue);
    }
  }, [datePickerValue, timeValue]);

  function handleDatePickerChange(date: Date) {
    if (date) {
      setDatePickerValue(formatISO(date, { representation: 'date' }));
    } else {
      setDatePickerValue(null);
    }
  }

  function handleTimePickerChange(value: string) {
    setTimeValue(value || null);
  }

  return (
    <fieldset className="slds-form-element slds-form-element_compound">
      {legendLabel && <legend className="slds-form-element__label slds-form-element__legend">{legendLabel}</legend>}
      <div className="slds-form-element__control">
        <div className="slds-form-element__group">
          <div className="slds-form-element__row">
            {/* FIXME: when moment is deprecated we should refactor */}
            <DatePicker {...dateProps} onChange={(value) => handleDatePickerChange(value.toDate())} />
            <TimePicker {...timeProps} onChange={handleTimePickerChange} />
          </div>
        </div>
      </div>
    </fieldset>
  );
};

export default DateTime;
