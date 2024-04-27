// https://www.lightningdesignsystem.com/components/input/#Fixed-Text

import { PositionLeftRight, PreviousNext } from '@jetstream/types';
import { isAfter, isBefore, setYear } from 'date-fns';
import { addMonths } from 'date-fns/addMonths';
import { formatDate } from 'date-fns/format';
import { startOfDay } from 'date-fns/startOfDay';
import { startOfMonth } from 'date-fns/startOfMonth';
import { toDate as cloneDate } from 'date-fns/toDate';
import { FunctionComponent, useEffect, useState } from 'react';
import Grid from '../../grid/Grid';
import GridCol from '../../grid/GridCol';
import DateGrid from './DateGrid';
import DateGridPrevNextSelector from './DateGridPrevNextSelector';

export interface DatePickerPopupProps {
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
  initialSelectedDate,
  initialVisibleDate = startOfMonth(new Date()),
  availableYears,
  minAvailableDate,
  maxAvailableDate,
  dropDownPosition = 'left',
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

  return (
    // <div
    //   aria-hidden="false"
    //   aria-label={`Date picker: ${visibleMonth}`}
    //   className={`slds-datepicker slds-dropdown slds-dropdown_${dropDownPosition}`}
    //   role="dialog"
    // >
    <>
      <DateGridPrevNextSelector
        id="date-picker"
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
      {/* </div> */}
    </>
  );
};

export default DatePickerPopup;
