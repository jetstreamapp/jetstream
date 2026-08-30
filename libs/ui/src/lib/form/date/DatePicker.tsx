// https://www.lightningdesignsystem.com/components/input/#Fixed-Text

import { css } from '@emotion/react';
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
import uniqueId from 'lodash/uniqueId';
import { ChangeEvent, FocusEvent, FunctionComponent, useEffect, useRef, useState } from 'react';
import { useEscapeToCloseLayer } from '../../hooks/useEscapeToCloseLayer';
import PopoverContainer from '../../popover/PopoverContainer';
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
  trigger?: 'onChange' | 'onBlur';
  /** Show an `x` in the input to clear the selected date without having to open the picker. */
  allowClear?: boolean;
  onChange: (date: Date | null) => void;
}

export const DatePicker: FunctionComponent<DatePickerProps> = ({
  id: _id,
  className,
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
  trigger = 'onChange',
  allowClear = false,
  onChange,
}) => {
  initialSelectedDate = isValidDate(initialSelectedDate) ? initialSelectedDate : undefined;
  initialVisibleDate = isValidDate(initialVisibleDate) ? initialVisibleDate : undefined;

  const inputRef = useRef<HTMLInputElement>(null);
  const datePickerRef = useRef<HTMLInputElement>(null);
  const entireContainerEl = useRef<HTMLDivElement>(null);
  const triggerButtonRef = useRef<HTMLButtonElement>(null);

  // Unique per mount to avoid auto-complete. Must be collision-proof: the old Date.now() suffix gave
  // two pickers mounted in the same millisecond (e.g. a From/To range) IDENTICAL ids, cross-wiring
  // their label associations — the first input announced both labels, the second announced none.
  const [id] = useState<string>(() => uniqueId(`${_id || 'date-picker'}-`));
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
      if (isValidDate(currDate) && trigger === 'onChange') {
        setSelectedDate(currDate);
      } // else invalid date
    } catch {
      // invalid date
    }
    if (value === '' && trigger === 'onChange') {
      onChange(null);
    }
  }

  function handleBlur(event: FocusEvent) {
    if (
      !entireContainerEl.current?.contains(event.relatedTarget as Node) &&
      !datePickerRef.current?.contains(event.relatedTarget as Node)
    ) {
      setIsOpen(false);
    }
    if (trigger !== 'onBlur') {
      return;
    }
    const currDate = parseISO(value);
    if (isValidDate(currDate) && selectedDate && !isSameDay(currDate, selectedDate)) {
      setSelectedDate(currDate);
    }
    if (value === '' && selectedDate) {
      onChange(null);
    }
  }

  // Escape closes ONLY the calendar popup — consumed at document capture so an ancestor
  // modal/popover cannot also close on the same press. Focus is pulled back to the trigger only
  // when it sat inside the popup (which unmounts); when the user is typing in the text input
  // (the popup opens on input click), focus must stay in the input.
  useEscapeToCloseLayer(isOpen, () => {
    setIsOpen(false);
    if (datePickerRef.current?.contains(document.activeElement)) {
      triggerButtonRef.current?.focus();
    }
  });

  // The popup unmounts on close, so focus must be handed back to the calendar trigger or it drops to <body>
  function returnFocusToTrigger() {
    triggerButtonRef.current?.focus();
  }

  function handleDateSelection(date: Date) {
    if (!selectedDate || !isSameDay(selectedDate, date)) {
      setIsOpen(false);
      returnFocusToTrigger();
    }
    setSelectedDate(startOfDay(date));
  }

  function handleClear() {
    setSelectedDate(undefined);
    setValue('');
    setIsOpen(false);
    onChange(null);
  }

  const showClearButton = allowClear && !readOnly && !!value;

  function handleToggleOpen(value: boolean) {
    if (readOnly && !isOpen) {
      return;
    }
    if (isOpen !== value) {
      setIsOpen(value);
    }
  }

  return (
    <div
      ref={entireContainerEl}
      className={classNames(
        'slds-form-element slds-dropdown-trigger slds-dropdown-trigger_click',
        { 'slds-is-open': isOpen, 'slds-has-error': hasError },
        className,
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
      <div
        className={classNames('slds-form-element__control slds-input-has-icon', {
          'slds-input-has-icon_group-right': showClearButton,
          'slds-input-has-icon_right': !showClearButton,
        })}
      >
        <input
          ref={inputRef}
          aria-describedby={[!hideLabel && labelHelp ? `${id}-label-help-text` : undefined, `${id}-date-format`, errorMessageId]
            .filter(Boolean)
            .join(' ')}
          type="text"
          autoComplete="off"
          id={id}
          placeholder=""
          className="slds-input"
          value={value}
          onChange={onValueChange}
          onBlur={handleBlur}
          readOnly={readOnly}
          onClick={() => {
            if (!isOpen) {
              handleToggleOpen(true);
            }
          }}
          disabled={disabled}
          {...inputProps}
        />
        <div
          className="slds-input__icon-group slds-input__icon-group_right"
          // SLDS positions and centers the group itself (absolute, right 0, top 50%, negative margin).
          // The buttons deliberately do NOT get slds-input__icon: that class absolutely positions each
          // icon (collapsing both onto the same spot) at higher specificity than an override can win —
          // instead they are plain icon buttons laid out as a flex row inside the group.
          css={css`
            display: flex;
            align-items: center;
            z-index: 2;
            padding-inline-end: 0.25rem;
            & > .slds-button + .slds-button {
              margin-left: 0.25rem;
            }
          `}
        >
          {showClearButton && (
            <button
              type="button"
              className="slds-button slds-button_icon"
              title={`Clear date for ${label}`}
              onClick={() => {
                handleClear();
                // The clear button removes itself when the value empties — keep focus in the field
                inputRef.current?.focus();
              }}
              disabled={disabled}
            >
              <Icon type="utility" icon="clear" className="slds-button__icon" omitContainer description={`Clear date for ${label}`} />
            </button>
          )}
          {/* Read-only fields have no calendar to open, so the trigger is omitted rather than rendered as
              an empty, inert button that still announces haspopup/expanded */}
          {!readOnly && (
            <button
              ref={triggerButtonRef}
              type="button"
              className="slds-button slds-button_icon"
              aria-haspopup="dialog"
              aria-expanded={isOpen}
              title={`Select a date for ${label}`}
              onClick={() => handleToggleOpen(!isOpen)}
              disabled={disabled}
            >
              {/* Scoped per field — a date range renders two otherwise-identical "Select a date" triggers */}
              <Icon type="utility" icon="event" className="slds-button__icon" omitContainer description={`Select a date for ${label}`} />
            </button>
          )}
        </div>
      </div>
      <div id={`${id}-date-format`} className="slds-assistive-text slds-form-element__help">
        Format: yyyy-mm-dd
      </div>
      <PopoverContainer
        isOpen={isOpen}
        role="dialog"
        aria-label="Choose a date"
        className={`slds-datepicker`}
        referenceElement={inputRef.current}
        onBlur={handleBlur}
        // Clicking non-focusable popup chrome (month heading, weekday labels) must not blur the input
        // and close the popup; focusable controls (days, buttons, the year select) still take focus
        onMouseDown={(event) => {
          if (!(event.target as HTMLElement).closest('button, select, input, [tabindex]')) {
            event.preventDefault();
          }
        }}
        usePortal={usePortal}
      >
        <DatePickerPopup
          ref={datePickerRef}
          id={id}
          initialSelectedDate={selectedDate}
          initialVisibleDate={initialVisibleDate || selectedDate}
          availableYears={availableYears}
          minAvailableDate={minAvailableDate}
          maxAvailableDate={maxAvailableDate}
          dropDownPosition={dropDownPosition}
          onClose={() => {
            handleToggleOpen(false);
            returnFocusToTrigger();
          }}
          onSelection={handleDateSelection}
          onClear={() => {
            handleClear();
            returnFocusToTrigger();
          }}
        />
      </PopoverContainer>
      {helpText && <div className="slds-form-element__help">{helpText}</div>}
      {hasError && errorMessage && (
        <div className="slds-form-element__help" id={errorMessageId}>
          {errorMessage}
        </div>
      )}
    </div>
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
