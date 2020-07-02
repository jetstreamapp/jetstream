/** @jsx jsx */
// https://www.lightningdesignsystem.com/components/input/#Fixed-Text
import { jsx } from '@emotion/core';
import classNames from 'classnames';
import moment from 'moment-mini';
import { ChangeEvent, FunctionComponent, useEffect, useState } from 'react';
import Icon from '../../widgets/Icon';
import DatePickerPopup from './DatePickerPopup';
import OutsideClickHandler from '../../utils/OutsideClickHandler';
import { PositionLeftRight } from '@jetstream/types';

export interface DatePickerProps {
  className?: string;
  label: string;
  hideLabel?: boolean;
  initialSelectedDate?: moment.Moment;
  initialVisibleDate?: moment.Moment;
  availableYears?: number[];
  dropDownPosition?: PositionLeftRight;
  onChange: (date: moment.Moment) => void;
}

export const DatePicker: FunctionComponent<DatePickerProps> = ({
  className,
  label,
  hideLabel,
  initialSelectedDate,
  initialVisibleDate,
  availableYears,
  dropDownPosition,
  onChange,
}) => {
  initialSelectedDate = initialSelectedDate && initialSelectedDate.isValid() ? initialSelectedDate : undefined;
  initialVisibleDate = initialVisibleDate && initialVisibleDate.isValid() ? initialVisibleDate : undefined;
  const [id] = useState<string>(`date-picker-${Date.now()}`); // used to avoid auto-complete
  const [value, setValue] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState(() =>
    initialSelectedDate && initialSelectedDate.isValid() ? initialSelectedDate : undefined
  );
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (selectedDate) {
      setValue(selectedDate.format('l'));
    }
  }, [selectedDate]);

  useEffect(() => {
    if (selectedDate) {
      onChange(selectedDate);
    }
  }, [onChange, selectedDate]);

  function onValueChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setValue(value);
    const currDate = moment(value, 'l');
    if (currDate.isValid()) {
      setSelectedDate(currDate);
    } // else invalid date
    if (value === '') {
      onChange(null);
    }
  }

  function handleDateSelection(date: moment.Moment) {
    if (!selectedDate || !selectedDate.isSame(date, 'day')) {
      setIsOpen(false);
    }
    setSelectedDate(date.startOf('day'));
  }

  function handleToggleOpen(value) {
    if (isOpen !== value) {
      setIsOpen(value);
    }
  }

  return (
    <div
      className={classNames('slds-form-element slds-dropdown-trigger slds-dropdown-trigger_click', { 'slds-is-open': isOpen }, className)}
    >
      <label className={classNames('slds-form-element__label', { 'slds-assistive-text': hideLabel })} htmlFor={id}>
        {label}
      </label>
      <div className="slds-form-element__control slds-input-has-icon slds-input-has-icon_right">
        <input
          type="text"
          autoComplete="false"
          id={id}
          placeholder=""
          className="slds-input"
          value={value}
          onChange={onValueChange}
          onClick={() => handleToggleOpen(true)}
        />
        <button
          className="slds-button slds-button_icon slds-input__icon slds-input__icon_right"
          title="Select a date"
          onClick={() => handleToggleOpen(true)}
        >
          <Icon type="utility" icon="event" className="slds-button__icon" omitContainer description="Select a date" />
        </button>
      </div>
      <OutsideClickHandler className="slds-combobox_container" onOutsideClick={() => handleToggleOpen(false)}>
        {isOpen && (
          <DatePickerPopup
            initialSelectedDate={selectedDate}
            initialVisibleDate={initialVisibleDate || selectedDate}
            availableYears={availableYears}
            dropDownPosition={dropDownPosition}
            onSelection={handleDateSelection}
          />
        )}
      </OutsideClickHandler>
    </div>
  );
};

export default DatePicker;
