/** @jsx jsx */
// https://www.lightningdesignsystem.com/components/input/#Fixed-Text
import { jsx } from '@emotion/core';
import moment from 'moment-mini';
import { FunctionComponent, useState, useEffect } from 'react';
import DateGrid from './DateGrid';
import DateGridPrevNextSelector from './DateGridPrevNextSelector';
import { PositionLeftRight, PreviousNext } from '@jetstream/types';

export interface DatePickerPopupProps {
  initialSelectedDate?: moment.Moment;
  initialVisibleDate?: moment.Moment;
  availableYears?: number[];
  dropDownPosition?: PositionLeftRight;
  onClose: () => void;
  onSelection: (date: moment.Moment) => void;
}

export const DatePickerPopup: FunctionComponent<DatePickerPopupProps> = ({
  initialSelectedDate,
  initialVisibleDate = moment().startOf('month'),
  availableYears,
  dropDownPosition = 'left',
  onClose,
  onSelection,
}) => {
  const [selectedDate, setSelectedDate] = useState(() => initialSelectedDate);
  const [visibleMonth, setVisibleMonth] = useState(initialVisibleDate);
  const [currMonthString, setCurrMonthString] = useState(() => initialVisibleDate.format('MMMM'));
  const [currMonth, setCurrMonth] = useState(() => initialVisibleDate.month());
  const [currYear, setCurrYear] = useState(() => initialVisibleDate.year());
  const [cameFromMonth, setCameFromMonth] = useState<PreviousNext>(null);

  useEffect(() => {
    setCurrMonthString(visibleMonth.format('MMMM'));
    setCurrMonth(visibleMonth.month());
    setCurrYear(visibleMonth.year());
  }, [visibleMonth]);

  // TODO: surround in input (maybe make new component called "DatePickerInput" for this)

  function handleSelection(date: moment.Moment) {
    date.startOf('day');
    setVisibleMonth(date.clone().startOf('month'));
    setSelectedDate(date.clone());
    onSelection(date.clone());
  }

  function handleOnPrevOnNext(numMonths: -1 | 1) {
    setCameFromMonth(numMonths === -1 ? 'NEXT' : 'PREVIOUS');
    setVisibleMonth(visibleMonth.clone().add(numMonths, 'month'));
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

      <button className="slds-button slds-align_absolute-center slds-text-link" onClick={() => handleSelection(moment())}>
        Today
      </button>
    </div>
  );
};

export default DatePickerPopup;
