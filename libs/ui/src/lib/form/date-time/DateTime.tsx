import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { Maybe } from '@jetstream/types';
import { formatISO, parse as parseDate, parseISO } from 'date-fns';
import { formatDate } from 'date-fns/format';
import { FunctionComponent, useState } from 'react';
import DatePicker, { DatePickerProps } from '../date/DatePicker';
import TimePicker, { TimePickerProps } from '../time-picker/TimePicker';

export interface DateTimeProps {
  legendLabel?: string;
  dateProps: Omit<DatePickerProps, 'onChange'>;
  timeProps: Omit<TimePickerProps, 'onChange'>;
  initialValue?: string;
  initialDateValue?: Date;
  rowContainerClassName?: string;
  // ISO8601 date string
  onChange: (date: string | null) => void;
}

const TIME_FORMAT = 'HH:mm:ss.SSS';

export const DateTime: FunctionComponent<DateTimeProps> = ({
  legendLabel,
  dateProps,
  timeProps,
  initialValue,
  initialDateValue,
  rowContainerClassName,
  onChange,
}) => {
  const [value, setValue] = useState<Maybe<string>>(() => {
    if (initialValue) {
      return initialValue;
    }
    if (initialDateValue) {
      return formatISO(initialDateValue);
    }
  });

  const [datePickerValue, setDatePickerValue] = useState<Maybe<string>>(() => {
    if (initialValue) {
      return formatISO(parseISO(initialValue), { representation: 'date' });
    }
    if (initialDateValue) {
      return formatISO(initialDateValue, { representation: 'date' });
    }
  });

  const [timeValue, setTimeValue] = useState<Maybe<string>>(() => {
    if (initialValue) {
      return formatDate(parseISO(initialValue), TIME_FORMAT);
    }
    if (initialDateValue) {
      return formatDate(initialDateValue, TIME_FORMAT);
    }
  });

  useNonInitialEffect(() => {
    let newValue: string | null = null;
    if (datePickerValue && timeValue) {
      // combine date and time into ISO8601
      newValue = formatISO(parseDate(timeValue, TIME_FORMAT, parseISO(datePickerValue)));
    } else if (datePickerValue) {
      newValue = formatISO(parseISO(datePickerValue));
    } else if (timeValue) {
      // do not allow stand-alone timeValue
      newValue = null;
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
          <div className={rowContainerClassName ?? 'slds-form-element__row slds-grid_vertical-align-end'}>
            <DatePicker {...dateProps} initialSelectedDate={initialDateValue} onChange={handleDatePickerChange} />
            <TimePicker {...timeProps} selectedItem={timeValue} onChange={handleTimePickerChange} />
          </div>
        </div>
      </div>
    </fieldset>
  );
};

export default DateTime;
