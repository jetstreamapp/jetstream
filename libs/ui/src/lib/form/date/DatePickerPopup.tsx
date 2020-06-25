/** @jsx jsx */
// https://www.lightningdesignsystem.com/components/input/#Fixed-Text
import { jsx } from '@emotion/core';
import moment from 'moment-mini';
import { FunctionComponent, useState, useEffect } from 'react';
import DateGrid from './DateGrid';
import DateGridPrevNextSelector from './DateGridPrevNextSelector';

export interface DatePickerPopupProps {
  initialSelectedDate?: moment.Moment;
  initialVisibleDate?: moment.Moment;
  availableYears?: number[];
  onSelection: (date: moment.Moment) => void;
}

export const DatePickerPopup: FunctionComponent<DatePickerPopupProps> = ({
  initialSelectedDate,
  initialVisibleDate = moment().startOf('month'),
  availableYears,
  onSelection,
}) => {
  const [selectedDate, setSelectedDate] = useState(() => initialSelectedDate);
  const [visibleMonth, setVisibleMonth] = useState(initialVisibleDate);
  const [currMonthString, setCurrMonthString] = useState(() => initialVisibleDate.format('MMMM'));
  const [currMonth, setCurrMonth] = useState(() => initialVisibleDate.month());
  const [currYear, setCurrYear] = useState(() => initialVisibleDate.year());

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

  return (
    <div
      aria-hidden="false"
      aria-label={`Date picker: ${visibleMonth}`}
      className="slds-datepicker slds-dropdown slds-dropdown_left"
      role="dialog"
    >
      <DateGridPrevNextSelector
        id="date-picker"
        availableYears={availableYears}
        currMonth={currMonthString}
        initialYear={currYear}
        onPrev={() => setVisibleMonth(visibleMonth.clone().add(-1, 'month'))}
        onNext={() => setVisibleMonth(visibleMonth.clone().add(1, 'month'))}
        onYearChange={setCurrYear}
      />
      <DateGrid currMonth={currMonth} currYear={currYear} selectedDate={selectedDate} onSelected={handleSelection} />

      <button className="slds-button slds-align_absolute-center slds-text-link" onClick={() => handleSelection(moment())}>
        Today
      </button>
    </div>
  );
};

export default DatePickerPopup;
