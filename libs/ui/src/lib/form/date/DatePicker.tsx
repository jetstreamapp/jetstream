/** @jsx jsx */
// https://www.lightningdesignsystem.com/components/input/#Fixed-Text
import { jsx } from '@emotion/core';
import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { PositionLeftRight } from '@jetstream/types';
import classNames from 'classnames';
import moment from 'moment-mini';
import { ChangeEvent, FunctionComponent, KeyboardEvent, useEffect, useState } from 'react';
import OutsideClickHandler from '../../utils/OutsideClickHandler';
import HelpText from '../../widgets/HelpText';
import Icon from '../../widgets/Icon';
import DatePickerPopup from './DatePickerPopup';

export interface DatePickerProps {
  id?: string;
  className?: string;
  // choose contents to ensure full width display
  containerDisplay?: 'block' | 'flex' | 'inline' | 'inline-block' | 'contents';
  label: string;
  hideLabel?: boolean;
  labelHelp?: string;
  helpText?: React.ReactNode | string;
  isRequired?: boolean;
  hasError?: boolean;
  errorMessageId?: string;
  errorMessage?: React.ReactNode | string;
  initialSelectedDate?: moment.Moment;
  initialVisibleDate?: moment.Moment;
  availableYears?: number[];
  dropDownPosition?: PositionLeftRight;
  disabled?: boolean;
  readOnly?: boolean;
  onChange: (date: moment.Moment) => void;
}

export const DatePicker: FunctionComponent<DatePickerProps> = ({
  id: _id,
  className,
  containerDisplay,
  label,
  hideLabel,
  labelHelp,
  helpText,
  isRequired,
  hasError,
  errorMessageId,
  errorMessage,
  initialSelectedDate,
  initialVisibleDate,
  availableYears,
  dropDownPosition,
  disabled,
  readOnly,
  onChange,
}) => {
  initialSelectedDate = initialSelectedDate && initialSelectedDate.isValid() ? initialSelectedDate : undefined;
  initialVisibleDate = initialVisibleDate && initialVisibleDate.isValid() ? initialVisibleDate : undefined;
  const [id] = useState<string>(`${_id || 'date-picker'}-${Date.now()}`); // used to avoid auto-complete
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

  useNonInitialEffect(() => {
    if (selectedDate) {
      onChange(selectedDate);
    }
  }, [selectedDate]);

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
    if (readOnly && !isOpen) {
      return;
    }
    if (isOpen !== value) {
      setIsOpen(value);
    }
  }

  return (
    <OutsideClickHandler display={containerDisplay} className="slds-combobox_container" onOutsideClick={() => handleToggleOpen(false)}>
      <div
        className={classNames(
          'slds-form-element slds-dropdown-trigger slds-dropdown-trigger_click',
          { 'slds-is-open': isOpen, 'slds-has-error': hasError },
          className
        )}
      >
        <label className={classNames('slds-form-element__label', { 'slds-assistive-text': hideLabel })} htmlFor={id}>
          {isRequired && (
            <abbr className="slds-required" title="required">
              *{' '}
            </abbr>
          )}
          {label}
        </label>
        {!hideLabel && labelHelp && <HelpText id={`${id}-label-help-text`} content={labelHelp} />}
        <div className="slds-form-element__control slds-input-has-icon slds-input-has-icon_right">
          <input
            aria-describedby={errorMessageId}
            type="text"
            autoComplete="false"
            id={id}
            placeholder=""
            className="slds-input"
            value={value}
            onChange={onValueChange}
            readOnly={readOnly}
            onClick={() => {
              if (!isOpen) {
                handleToggleOpen(true);
              }
            }}
            onKeyUp={(event: KeyboardEvent<HTMLInputElement>) => {
              if (isOpen && event.keyCode === 27) {
                handleToggleOpen(false);
              }
            }}
            disabled={disabled}
          />
          <button
            className="slds-button slds-button_icon slds-input__icon slds-input__icon_right"
            title="Select a date"
            onClick={() => {
              if (!isOpen) {
                handleToggleOpen(true);
              }
            }}
            disabled={disabled}
          >
            {!readOnly && <Icon type="utility" icon="event" className="slds-button__icon" omitContainer description="Select a date" />}
          </button>
        </div>
        {isOpen && (
          <DatePickerPopup
            initialSelectedDate={selectedDate}
            initialVisibleDate={initialVisibleDate || selectedDate}
            availableYears={availableYears}
            dropDownPosition={dropDownPosition}
            onClose={() => handleToggleOpen(false)}
            onSelection={handleDateSelection}
          />
        )}
        {helpText && <div className="slds-form-element__help">{helpText}</div>}
        {hasError && errorMessage && (
          <div className="slds-form-element__help" id={errorMessageId}>
            {errorMessage}
          </div>
        )}
      </div>
    </OutsideClickHandler>
  );
};

export default DatePicker;
