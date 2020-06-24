/** @jsx jsx */
// https://www.lightningdesignsystem.com/components/input/#Fixed-Text
import { jsx } from '@emotion/core';
import moment from 'moment-mini';
import { FunctionComponent, useState, useEffect } from 'react';
import DateGrid from './DateGrid';
import DateGridPrevNextSelector from './DateGridPrevNextSelector';

export interface DatePickerProps {
  initialSelectedDate?: moment.Moment;
  initialVisibleDate?: moment.Moment;
  availableYears?: number[];
}

export const DatePicker: FunctionComponent<DatePickerProps> = ({
  initialSelectedDate,
  initialVisibleDate = moment().startOf('month'),
  availableYears,
}) => {
  const [selectedDate, setSelectedDate] = useState(() => initialSelectedDate);
  const [visibleMonth, setVisibleMonth] = useState(initialVisibleDate);
  const [currMonthString, setCurrMonthString] = useState(() => initialVisibleDate.format('MMMM'));
  const [currMonth, setCurrMonth] = useState(() => initialVisibleDate.month());
  const [currYear, setCurrYear] = useState(() => initialVisibleDate.year());

  useEffect(() => {
    setCurrMonthString(visibleMonth.format('MMMM'));
    setCurrMonth(visibleMonth.month());
  }, [visibleMonth]);

  return (
    <div aria-hidden="false" aria-label="Date picker: June" className="slds-datepicker slds-dropdown slds-dropdown_left" role="dialog">
      <DateGridPrevNextSelector
        id="date-picker"
        availableYears={availableYears}
        currMonth={currMonthString}
        initialYear={currYear}
        onPrev={() => setVisibleMonth(visibleMonth.clone().add(-1, 'month'))}
        onNext={() => setVisibleMonth(visibleMonth.clone().add(1, 'month'))}
        onYearChange={setCurrYear}
      />
      <DateGrid currMonth={currMonth} currYear={currYear} selectedDate={selectedDate} onSelected={setSelectedDate} />

      <button className="slds-button slds-align_absolute-center slds-text-link">Today</button>
    </div>
  );
};

export default DatePicker;
