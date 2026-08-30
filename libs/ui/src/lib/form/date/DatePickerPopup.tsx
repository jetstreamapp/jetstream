// https://www.lightningdesignsystem.com/components/input/#Fixed-Text

import { PositionLeftRight, PreviousNext } from '@jetstream/types';
import { addMonths } from 'date-fns/addMonths';
import { formatDate } from 'date-fns/format';
import { isAfter } from 'date-fns/isAfter';
import { isBefore } from 'date-fns/isBefore';
import { setYear } from 'date-fns/setYear';
import { startOfDay } from 'date-fns/startOfDay';
import { startOfMonth } from 'date-fns/startOfMonth';
import { toDate as cloneDate } from 'date-fns/toDate';
import { FunctionComponent, useEffect, useState } from 'react';
import Grid from '../../grid/Grid';
import GridCol from '../../grid/GridCol';
import DateGrid from './DateGrid';
import DateGridPrevNextSelector from './DateGridPrevNextSelector';

export interface DatePickerPopupProps {
  ref?: React.Ref<HTMLDivElement>;
  /** The owning DatePicker's id — scopes the heading/select ids so two pickers on a page do not collide */
  id: string;
  initialSelectedDate?: Date;
  initialVisibleDate?: Date;
  dropDownPosition?: PositionLeftRight;
  availableYears: number[];
  minAvailableDate?: Date;
  maxAvailableDate?: Date;
  onClose: () => void;
  onSelection: (date: Date) => void;
  onClear: () => void;
}

export const DatePickerPopup: FunctionComponent<DatePickerPopupProps> = ({
  ref,
  id,
  initialSelectedDate,
  initialVisibleDate = startOfMonth(new Date()),
  availableYears,
  minAvailableDate,
  maxAvailableDate,
  onClose,
  onSelection,
  onClear,
}) => {
  const [selectedDate, setSelectedDate] = useState(() => initialSelectedDate);
  const [visibleMonth, setVisibleMonth] = useState(initialVisibleDate);
  const [currMonthString, setCurrMonthString] = useState(() => formatDate(initialVisibleDate, 'MMMM'));
  const [currMonth, setCurrMonth] = useState(() => initialVisibleDate.getMonth());
  const [currYear, setCurrYear] = useState(() => initialVisibleDate.getFullYear());
  const [cameFromMonth, setCameFromMonth] = useState<PreviousNext | null>(null);
  const [prevMonthAvailable, setPrevMonthAvailable] = useState(true);
  const [nextMonthAvailable, setNextMonthAvailable] = useState(true);

  useEffect(() => {
    setCurrMonthString(formatDate(visibleMonth, 'MMMM'));
    setCurrMonth(visibleMonth.getMonth());
    setCurrYear(visibleMonth.getFullYear());
  }, [visibleMonth]);

  useEffect(() => {
    if (minAvailableDate) {
      setPrevMonthAvailable(isBefore(startOfMonth(minAvailableDate), visibleMonth));
    }
    if (maxAvailableDate) {
      setNextMonthAvailable(isAfter(startOfMonth(maxAvailableDate), visibleMonth));
    }
  }, [maxAvailableDate, minAvailableDate, visibleMonth]);

  function handleSelection(date: Date) {
    setVisibleMonth(startOfMonth(date));
    setSelectedDate(cloneDate(date));
    onSelection(cloneDate(date));
  }

  function handleClear() {
    setSelectedDate(undefined);
    onClear();
  }

  function handleOnPrevOnNext(numMonths: -1 | 1) {
    if ((numMonths === -1 && prevMonthAvailable) || (numMonths === 1 && nextMonthAvailable)) {
      setCameFromMonth(numMonths === -1 ? 'NEXT' : 'PREVIOUS');
      const newDate = addMonths(visibleMonth, numMonths);
      setVisibleMonth(newDate);
    }
  }

  function handleYearChange(currYear: number) {
    setCurrYear(currYear);
    setVisibleMonth(setYear(visibleMonth, currYear));
  }

  /**
   * Dialog-wide keyboard contract (the popup renders as role="dialog"):
   * - Escape closes from ANY element — owned by DatePicker's useEscapeToCloseLayer, which consumes
   *   the key at document capture before this handler could ever see it
   * - Tab/Shift+Tab wrap within the popup (a dialog traps Tab per the APG)
   */
  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Tab') {
      return;
    }
    const focusables = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), select:not(:disabled), [tabindex="0"]'),
    );
    if (!focusables.length) {
      return;
    }
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    // Delegated dialog-level handler (Escape / Tab trap) — the wrapping PopoverContainer provides role="dialog"
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions
    <div ref={ref} onKeyDown={handleKeyDown}>
      <DateGridPrevNextSelector
        id={`${id}-month`}
        currMonth={currMonthString}
        currYear={currYear}
        availableYears={availableYears}
        prevMonthAvailable={prevMonthAvailable}
        nextMonthAvailable={nextMonthAvailable}
        onPrev={() => handleOnPrevOnNext(-1)}
        onNext={() => handleOnPrevOnNext(1)}
        onYearChange={handleYearChange}
      />
      <DateGrid
        labelledById={`${id}-month`}
        currMonth={currMonth}
        currYear={currYear}
        selectedDate={selectedDate}
        cameFromMonth={cameFromMonth}
        minYear={availableYears[0]}
        maxYear={availableYears[availableYears.length - 1]}
        minAvailableDate={minAvailableDate}
        maxAvailableDate={maxAvailableDate}
        onSelected={handleSelection}
        onClose={onClose}
        onPrevMonth={() => handleOnPrevOnNext(-1)}
        onNextMonth={() => handleOnPrevOnNext(1)}
        onPrevYear={() => setCurrYear(currYear - 1)}
        onNextYear={() => setCurrYear(currYear + 1)}
      />
      <Grid align="spread" className="slds-m-horizontal_small">
        <GridCol>
          <button className="slds-button slds-align_absolute-center slds-text-link" onClick={() => handleClear()} disabled={!selectedDate}>
            Clear
          </button>
        </GridCol>
        <GridCol>
          <button className="slds-button slds-align_absolute-center slds-text-link" onClick={() => handleSelection(startOfDay(new Date()))}>
            Today
          </button>
        </GridCol>
      </Grid>
    </div>
  );
};

export default DatePickerPopup;
