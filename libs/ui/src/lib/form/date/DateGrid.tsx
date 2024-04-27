// https://www.lightningdesignsystem.com/components/input/#Fixed-Text
import { css } from '@emotion/react';
import {
  hasModifierKey,
  isArrowDownKey,
  isArrowLeftKey,
  isArrowRightKey,
  isArrowUpKey,
  isEndKey,
  isEnterOrSpace,
  isEscapeKey,
  isHomeKey,
  isPageDownKey,
  isPageUpKey,
} from '@jetstream/shared/ui-utils';
import { PreviousNext } from '@jetstream/types';
import classNames from 'classnames';
import { addDays } from 'date-fns/addDays';
import { addWeeks } from 'date-fns/addWeeks';
import { endOfMonth } from 'date-fns/endOfMonth';
import { isAfter } from 'date-fns/isAfter';
import { isBefore } from 'date-fns/isBefore';
import { isSameDay } from 'date-fns/isSameDay';
import { isSameMonth } from 'date-fns/isSameMonth';
import { setDay } from 'date-fns/setDay';
import { setMonth } from 'date-fns/setMonth';
import { setYear } from 'date-fns/setYear';
import { startOfMonth } from 'date-fns/startOfMonth';
import isNumber from 'lodash/isNumber';
import { FunctionComponent, KeyboardEvent, RefObject, createRef, useEffect, useRef, useState } from 'react';

interface DateGridDate {
  label: number;
  value: Date;
  readOnly: boolean;
  isCurrMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
}

interface DateGridSelection {
  selectedIdx: { week: number; day: number } | undefined;
  todayIdx: { week: number; day: number } | undefined;
  firstOfMonthIdx: { week: number; day: number } | undefined;
  lastOfMonthIdx: { week: number; day: number } | undefined;
}

function getSelectedDates(dateGrid: DateGridDate[][]): DateGridSelection {
  const selection: DateGridSelection = {
    selectedIdx: undefined,
    todayIdx: undefined,
    firstOfMonthIdx: undefined,
    lastOfMonthIdx: undefined,
  };
  let lastDayOfMonth: Date | undefined = undefined;
  dateGrid.forEach((week, i) => {
    week.forEach((day, k) => {
      if (day.isCurrMonth) {
        if (!lastDayOfMonth) {
          lastDayOfMonth = endOfMonth(day.value);
        }
        if (day.isToday) {
          selection.todayIdx = { week: i, day: k };
        }
        if (day.value.getDate() === 1) {
          selection.firstOfMonthIdx = { week: i, day: k };
        } else if (isSameDay(day.value, lastDayOfMonth)) {
          selection.lastOfMonthIdx = { week: i, day: k };
        }
        if (day.isSelected) {
          selection.selectedIdx = { week: i, day: k };
        }
      }
    });
  });
  return selection;
}

export interface DateGridProps {
  minYear: number;
  maxYear: number;
  minAvailableDate?: Date;
  maxAvailableDate?: Date;
  currMonth: number;
  currYear: number;
  selectedDate?: Date;
  cameFromMonth: PreviousNext | null;

  onClose: () => void;
  onSelected: (date: Date) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onPrevYear: () => void;
  onNextYear: () => void;
}

export const DateGrid: FunctionComponent<DateGridProps> = ({
  minYear,
  maxYear,
  minAvailableDate,
  maxAvailableDate,
  currMonth,
  currYear,
  selectedDate,
  cameFromMonth,
  onClose,
  onSelected,
  onPrevMonth,
  onNextMonth,
  onPrevYear,
  onNextYear,
}) => {
  const [dateGrid, setDateGrid] = useState<DateGridDate[][]>([]);
  const elRefs = useRef<RefObject<HTMLTableDataCellElement>[][]>([]);

  if (elRefs.current.length !== dateGrid.length) {
    const refs: RefObject<HTMLTableDataCellElement>[][] = [];
    dateGrid.forEach((week, i) => {
      refs[i] = elRefs[i] || [];
      week.forEach((day, k) => {
        refs[i][k] = refs[i][k] ? refs[i][k] : createRef();
      });
    });
    // add or remove refs
    elRefs.current = refs;
  }

  /**
   * Determine which day should be initially focused
   */
  useEffect(() => {
    try {
      if (dateGrid && elRefs.current && elRefs.current.length > 0) {
        const { firstOfMonthIdx, lastOfMonthIdx, selectedIdx, todayIdx } = getSelectedDates(dateGrid);
        if (cameFromMonth === 'PREVIOUS' && firstOfMonthIdx) {
          elRefs.current?.[firstOfMonthIdx.week]?.[firstOfMonthIdx.day]?.current?.focus();
        } else if (cameFromMonth === 'NEXT' && lastOfMonthIdx) {
          elRefs.current?.[lastOfMonthIdx.week]?.[lastOfMonthIdx.day]?.current?.focus();
        } else {
          if (selectedIdx) {
            elRefs.current?.[selectedIdx.week]?.[selectedIdx.day]?.current?.focus();
          } else if (todayIdx) {
            elRefs.current?.[todayIdx.week]?.[todayIdx.day]?.current?.focus();
          } else if (firstOfMonthIdx) {
            elRefs.current?.[firstOfMonthIdx.week]?.[firstOfMonthIdx.day]?.current?.focus();
          }
        }
      }
    } catch (ex) {
      // silent failure
    }
  }, [cameFromMonth, dateGrid]);

  // Calculate date grid for a 5 week period
  useEffect(() => {
    let date: Date;
    if (isNumber(currMonth) && isNumber(currYear)) {
      date = startOfMonth(setYear(setMonth(new Date(), currMonth), currYear));
    } else {
      date = startOfMonth(new Date());
    }
    // Set date to sunday of current week, which is likely in prior month
    const startDate = setDay(date, 0);
    // set end date to show a full 5 weeks from start date
    const endDate = addDays(addWeeks(startDate, 6), -1);

    if (endDate.getDate() < 7) {
      endDate.setDate(7);
    }

    const today = new Date();
    let currDate = startDate;
    const grid: DateGridDate[][] = [];
    let currWeek: DateGridDate[] = [];
    let isFirstIteration = true;
    // create grid
    while (isBefore(currDate, endDate) || isSameDay(currDate, endDate)) {
      if (!isFirstIteration && currDate.getDay() === 0) {
        grid.push(currWeek);
        currWeek = [];
      }
      let readOnly = false;
      if (currDate.getFullYear() < minYear || currDate.getFullYear() > maxYear) {
        readOnly = true;
      } else if (minAvailableDate && isBefore(currDate, minAvailableDate)) {
        readOnly = true;
      } else if (maxAvailableDate && isAfter(currDate, maxAvailableDate)) {
        readOnly = true;
      }
      isFirstIteration = false;
      currWeek.push({
        label: currDate.getDate(),
        value: currDate,
        readOnly,
        isCurrMonth: currDate.getMonth() === currMonth,
        isToday: isSameDay(currDate, today),
        isSelected: !!selectedDate && isSameDay(currDate, selectedDate),
      });
      currDate = addDays(currDate, 1);
    }
    setDateGrid(grid);
  }, [selectedDate, currMonth, currYear, minAvailableDate, maxAvailableDate, minYear, maxYear]);

  /**
   * Handle keyboard navigation
   * Esc = close
   * enter/space = select
   * arrows navigate around on grid
   * up/down can go to next/prev months
   * home/end go to beginning and end of row
   * page up/down toggle months
   * modifier+up/down toggle years
   */
  function handleKeyUp(day: DateGridDate, weekIdx: number, dayIdx: number, event: KeyboardEvent<HTMLTableDataCellElement>) {
    event.preventDefault();
    event.stopPropagation();
    const currentRefs = elRefs.current;
    let targetWeekIdx;
    let targetDayIdx;

    if (isEscapeKey(event)) {
      onClose();
      return;
    }

    if (isEnterOrSpace(event)) {
      if (!day.readOnly) {
        onSelected(day.value);
      }
      return;
    }

    if (hasModifierKey(event)) {
      if (isArrowUpKey(event)) {
        return onPrevYear();
      } else if (isArrowDownKey(event)) {
        return onNextYear();
      }
    }

    if (isPageUpKey(event)) {
      return onPrevMonth();
    } else if (isPageDownKey(event)) {
      return onNextMonth();
    } else if (isHomeKey(event)) {
      targetWeekIdx = weekIdx;
      targetDayIdx = 0;
    } else if (isEndKey(event)) {
      targetWeekIdx = weekIdx;
      targetDayIdx = currentRefs[weekIdx].length - 1;
    } else if (isArrowLeftKey(event)) {
      if (dayIdx === 0) {
        targetWeekIdx = weekIdx;
        targetDayIdx = currentRefs[weekIdx].length - 1;
      } else {
        targetWeekIdx = weekIdx;
        targetDayIdx = dayIdx - 1;
      }
    } else if (isArrowUpKey(event)) {
      if (weekIdx === 0) {
        return onPrevMonth();
      } else {
        targetWeekIdx = weekIdx - 1;
        targetDayIdx = dayIdx;
      }
    } else if (isArrowRightKey(event)) {
      if (dayIdx === currentRefs[weekIdx].length - 1) {
        targetWeekIdx = weekIdx;
        targetDayIdx = 0;
      } else {
        targetWeekIdx = weekIdx;
        targetDayIdx = dayIdx + 1;
      }
    } else if (isArrowDownKey(event)) {
      if (weekIdx === currentRefs.length - 1) {
        return onNextMonth();
      } else {
        targetWeekIdx = weekIdx + 1;
        targetDayIdx = dayIdx;
      }
    }
    // check if target week/day were set
    if (isNumber(targetWeekIdx) && isNumber(targetDayIdx)) {
      const newDay = dateGrid[targetWeekIdx][targetDayIdx].value;
      // if day is in different month, then change months
      if (isSameMonth(newDay, day.value)) {
        currentRefs[targetWeekIdx]?.[targetDayIdx]?.current?.focus();
      } else if (isBefore(newDay, day.value)) {
        onPrevMonth();
      } else {
        onNextMonth();
      }
    }
  }

  return (
    <table aria-labelledby="datepicker-month" aria-multiselectable="true" className="slds-datepicker__month" role="grid">
      <thead>
        <tr id="datepicker-weekdays">
          <th id="datepicker-Sunday" scope="col">
            <abbr title="Sunday">Sun</abbr>
          </th>
          <th id="datepicker-Monday" scope="col">
            <abbr title="Monday">Mon</abbr>
          </th>
          <th id="datepicker-Tuesday" scope="col">
            <abbr title="Tuesday">Tue</abbr>
          </th>
          <th id="datepicker-Wednesday" scope="col">
            <abbr title="Wednesday">Wed</abbr>
          </th>
          <th id="datepicker-Thursday" scope="col">
            <abbr title="Thursday">Thu</abbr>
          </th>
          <th id="datepicker-Friday" scope="col">
            <abbr title="Friday">Fri</abbr>
          </th>
          <th id="datepicker-Saturday" scope="col">
            <abbr title="Saturday">Sat</abbr>
          </th>
        </tr>
      </thead>
      <tbody>
        {dateGrid.map((week, i) => {
          return (
            <tr key={i}>
              {week.map((day, k) => (
                <td
                  key={day.value.valueOf()}
                  ref={elRefs.current[i][k]}
                  aria-selected={day.isSelected}
                  className={classNames({
                    'slds-is-selected': day.isSelected,
                    'slds-day_adjacent-month': !day.isCurrMonth || day.readOnly,
                    'slds-is-today': day.isToday,
                    'slds-disabled-text': day.readOnly,
                  })}
                  css={css`
                    ${day.readOnly && `cursor: not-allowed`}
                  `}
                  role="gridcell"
                  aria-disabled={day.readOnly}
                  tabIndex={day.readOnly ? undefined : day.label === 1 && day.isCurrMonth ? 0 : -1}
                  onClick={() => !day.readOnly && onSelected(day.value)}
                  onKeyUp={(event) => handleKeyUp(day, i, k, event)}
                >
                  <span className="slds-day">{day.label}</span>
                </td>
              ))}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

export default DateGrid;
