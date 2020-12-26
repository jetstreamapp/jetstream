/** @jsx jsx */
// https://www.lightningdesignsystem.com/components/input/#Fixed-Text
import { jsx } from '@emotion/core';
import { FunctionComponent, useState, useEffect } from 'react';
import DateGrid from './DateGrid';
import DateGridPrevNextSelector from './DateGridPrevNextSelector';
import { PositionLeftRight, PreviousNext } from '@jetstream/types';
import startOfDay from 'date-fns/startOfDay';
import startOfMonth from 'date-fns/startOfMonth';
import addMonths from 'date-fns/addMonths';
import formatDate from 'date-fns/format';
import cloneDate from 'date-fns/toDate';

export interface DatePickerPopupProps {
  initialSelectedDate?: Date;
  initialVisibleDate?: Date;
  availableYears?: number[];
  dropDownPosition?: PositionLeftRight;
  onClose: () => void;
  onSelection: (date: Date) => void;
}

export const DatePickerPopup: FunctionComponent<DatePickerPopupProps> = ({
  initialSelectedDate,
  initialVisibleDate = startOfMonth(new Date()),
  availableYears,
  dropDownPosition = 'left',
  onClose,
  onSelection,
}) => {
  const [selectedDate, setSelectedDate] = useState(() => initialSelectedDate);
  const [visibleMonth, setVisibleMonth] = useState(initialVisibleDate);
  const [currMonthString, setCurrMonthString] = useState(() => formatDate(initialVisibleDate, 'MMMM'));
  const [currMonth, setCurrMonth] = useState(() => initialVisibleDate.getMonth());
  const [currYear, setCurrYear] = useState(() => initialVisibleDate.getFullYear());
  const [cameFromMonth, setCameFromMonth] = useState<PreviousNext>(null);

  useEffect(() => {
    setCurrMonthString(formatDate(visibleMonth, 'MMMM'));
    setCurrMonth(visibleMonth.getMonth());
    setCurrYear(visibleMonth.getFullYear());
  }, [visibleMonth]);

  function handleSelection(date: Date) {
    setVisibleMonth(startOfMonth(date));
    setSelectedDate(cloneDate(date));
    onSelection(cloneDate(date));
  }

  function handleOnPrevOnNext(numMonths: -1 | 1) {
    setCameFromMonth(numMonths === -1 ? 'NEXT' : 'PREVIOUS');
    setVisibleMonth(addMonths(visibleMonth, numMonths));
  }

  return (
    <div
      aria-hidden="false"
      aria-label={`Date picker: ${visibleMonth}`}
      className={`slds-datepicker slds-dropdown slds-dropdown_${dropDownPosition}`}
      role="dialog"
    >
      <DateGridPrevNextSelector
        id="date-picker"
        availableYears={availableYears}
        currMonth={currMonthString}
        currYear={currYear}
        onPrev={() => handleOnPrevOnNext(-1)}
        onNext={() => handleOnPrevOnNext(1)}
        onYearChange={setCurrYear}
      />
      <DateGrid
        currMonth={currMonth}
        currYear={currYear}
        selectedDate={selectedDate}
        cameFromMonth={cameFromMonth}
        onSelected={handleSelection}
        onClose={onClose}
        onPrevMonth={() => handleOnPrevOnNext(-1)}
        onNextMonth={() => handleOnPrevOnNext(1)}
        onPrevYear={() => setCurrYear(currYear - 1)}
        onNextYear={() => setCurrYear(currYear + 1)}
      />

      <button className="slds-button slds-align_absolute-center slds-text-link" onClick={() => handleSelection(startOfDay(new Date()))}>
        Today
      </button>
    </div>
  );
};

export default DatePickerPopup;
