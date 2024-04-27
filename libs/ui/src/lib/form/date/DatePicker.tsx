// https://www.lightningdesignsystem.com/components/input/#Fixed-Text

import { useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { PositionLeftRight } from '@jetstream/types';
import classNames from 'classnames';
import { formatISO } from 'date-fns/formatISO';
import { isAfter } from 'date-fns/isAfter';
import { isBefore } from 'date-fns/isBefore';
import { isSameDay } from 'date-fns/isSameDay';
import { isValid as isValidDate } from 'date-fns/isValid';
import { parseISO } from 'date-fns/parseISO';
import { startOfDay } from 'date-fns/startOfDay';
import { ChangeEvent, FunctionComponent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import PopoverContainer from '../../popover/PopoverContainer';
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
  hideLabel?: boolean | null;
  labelHelp?: string | null;
  helpText?: React.ReactNode | string;
  isRequired?: boolean;
  hasError?: boolean;
  errorMessageId?: string;
  errorMessage?: React.ReactNode | string;
  initialSelectedDate?: Date;
  initialVisibleDate?: Date;
  minAvailableDate?: Date;
  maxAvailableDate?: Date;
  dropDownPosition?: PositionLeftRight;
  disabled?: boolean;
  readOnly?: boolean;
  inputProps?: React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>;
  usePortal?: boolean;
  openOnInit?: boolean;
  onChange: (date: Date | null) => void;
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
  minAvailableDate: initialMinAvailableDate,
  maxAvailableDate: initialMaxAvailableDate,
  dropDownPosition,
  disabled,
  readOnly,
  inputProps,
  openOnInit = false,
  usePortal = false,
  onChange,
}) => {
  initialSelectedDate = isValidDate(initialSelectedDate) ? initialSelectedDate : undefined;
  initialVisibleDate = isValidDate(initialVisibleDate) ? initialVisibleDate : undefined;
  const inputRef = useRef<HTMLInputElement>(null);
  const [popoverRef, setPopoverRef] = useState<HTMLDivElement | null>(null);
  const [id] = useState<string>(`${_id || 'date-picker'}-${Date.now()}`); // used to avoid auto-complete
  const [value, setValue] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState(() => (isValidDate(initialSelectedDate) ? initialSelectedDate : undefined));
  const [isOpen, setIsOpen] = useState(openOnInit);
  const [availableYears, setAvailableYears] = useState(() => getDatePickerYears(initialMinAvailableDate, initialMaxAvailableDate));

  const [minAvailableDate, setMinAvailableDate] = useState(initialMinAvailableDate);
  const [maxAvailableDate, setMaxAvailableDate] = useState(initialMaxAvailableDate);

  useEffect(() => {
    if (selectedDate) {
      setValue(formatISO(selectedDate, { representation: 'date' }));
    }
  }, [selectedDate]);

  useNonInitialEffect(() => {
    setMinAvailableDate(initialMinAvailableDate);
    setMaxAvailableDate(initialMaxAvailableDate);
  }, [initialMinAvailableDate, initialMaxAvailableDate]);

  useNonInitialEffect(() => {
    setAvailableYears(getDatePickerYears(minAvailableDate, maxAvailableDate));
  }, [minAvailableDate, maxAvailableDate]);

  // If selected date is beyond valid range, change valid range to include this date
  useEffect(() => {
    if (selectedDate && minAvailableDate && isAfter(minAvailableDate, selectedDate)) {
      setMinAvailableDate(selectedDate);
    } else if (selectedDate && maxAvailableDate && isBefore(maxAvailableDate, selectedDate)) {
      setMaxAvailableDate(selectedDate);
    }
  }, [selectedDate, minAvailableDate, maxAvailableDate]);

  useNonInitialEffect(() => {
    if (selectedDate) {
      onChange(selectedDate);
    }
  }, [selectedDate]);

  function onValueChange(event: ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setValue(value);
    try {
      const currDate = parseISO(value);
      if (isValidDate(currDate)) {
        setSelectedDate(currDate);
      } // else invalid date
    } catch (ex) {
      // invalid date
    }
    if (value === '') {
      onChange(null);
    }
  }

  function handleDateSelection(date: Date) {
    if (!selectedDate || !isSameDay(selectedDate, date)) {
      setIsOpen(false);
    }
    setSelectedDate(startOfDay(date));
  }

  function handleClear() {
    setSelectedDate(undefined);
    setValue('');
    setIsOpen(false);
    onChange(null);
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
    <OutsideClickHandler
      additionalParentRef={popoverRef}
      display={containerDisplay}
      className="slds-combobox_container"
      onOutsideClick={() => handleToggleOpen(false)}
    >
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
            ref={inputRef}
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
            {...inputProps}
          />
          <button
            className="slds-button slds-button_icon slds-input__icon slds-input__icon_right"
            title="Select a date"
            onClick={() => handleToggleOpen(!isOpen)}
            disabled={disabled}
          >
            {!readOnly && <Icon type="utility" icon="event" className="slds-button__icon" omitContainer description="Select a date" />}
          </button>
        </div>
        <PopoverContainer
          ref={setPopoverRef}
          isOpen={isOpen}
          className={`slds-datepicker`}
          referenceElement={inputRef.current}
          usePortal={usePortal}
        >
          <DatePickerPopup
            initialSelectedDate={selectedDate}
            initialVisibleDate={initialVisibleDate || selectedDate}
            availableYears={availableYears}
            minAvailableDate={minAvailableDate}
            maxAvailableDate={maxAvailableDate}
            dropDownPosition={dropDownPosition}
            onClose={() => handleToggleOpen(false)}
            onSelection={handleDateSelection}
            onClear={handleClear}
          />
        </PopoverContainer>
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

/**
 * Returns an array of years available for selection in the datepicker
 *
 * @param minAvailableDate The year from this date is used for the earliest year. Defaults to 1970
 * @param maxAvailableDate The year from this date is used for the latest year. Defaults to current year + 50
 */
export function getDatePickerYears(minAvailableDate?: Date | null, maxAvailableDate?: Date | null) {
  let minYear = minAvailableDate?.getFullYear() || 1969;
  const maxYear = maxAvailableDate?.getFullYear() || new Date().getFullYear() + 50;
  if (minYear > maxYear) {
    minYear = maxYear;
  }
  let currYear = minYear;
  const output = new Set<number>();
  while (currYear <= maxYear) {
    output.add(currYear);
    currYear++;
  }
  return Array.from(output);
}

export default DatePicker;
