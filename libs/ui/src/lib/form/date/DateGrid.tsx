/** @jsx jsx */
// https://www.lightningdesignsystem.com/components/input/#Fixed-Text
import { jsx } from '@emotion/core';
import classNames from 'classnames';
import moment from 'moment-mini';
import { FunctionComponent, useEffect, useState, useRef, KeyboardEvent, createRef, RefObject } from 'react';
import { isNumber } from 'lodash';
import { PreviousNext } from '@jetstream/types';

interface DateGridDate {
  label: number;
  value: moment.Moment;
  isCurrMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
}

export interface DateGridProps {
  currMonth: number;
  currYear: number;
  selectedDate?: moment.Moment;
  cameFromMonth: PreviousNext;
  onClose: () => void;
  onSelected: (date: moment.Moment) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onPrevYear: () => void;
  onNextYear: () => void;
}

export const DateGrid: FunctionComponent<DateGridProps> = ({
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
  // const tdRefs = useRef<RefObject<HTMLTableDataCellElement>[][]>([]);
  // const [elRefs, setElRefs] = useState<RefObject<HTMLTableDataCellElement>[][]>([]);
  const elRefs = useRef<RefObject<HTMLTableDataCellElement>[][]>([]);

  if (elRefs.current.length !== dateGrid.length) {
    const refs: RefObject<HTMLTableDataCellElement>[][] = [];
    dateGrid.forEach((week, i) => {
      refs[i] = elRefs[i] || [];
      week.forEach((week, k) => {
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
    if (dateGrid && elRefs.current && elRefs.current.length > 0) {
      let selectedIdx: { week: number; day: number };
      let todayIdx: { week: number; day: number };
      let firstOfMonthIdx: { week: number; day: number };
      let lastOfMonthIdx: { week: number; day: number };
      let lastDayOfMonth;
      dateGrid.forEach((week, i) => {
        week.forEach((day, k) => {
          if (day.isCurrMonth) {
            if (!lastDayOfMonth) {
              lastDayOfMonth = moment(day.value).endOf('month');
            }
            if (day.isToday) {
              todayIdx = { week: i, day: k };
            }
            if (day.value.date() === 1) {
              firstOfMonthIdx = { week: i, day: k };
            } else if (day.value.isSame(lastDayOfMonth, 'day')) {
              lastOfMonthIdx = { week: i, day: k };
            }
            if (day.isSelected) {
              selectedIdx = { week: i, day: k };
            }
          }
        });
      });
      if (cameFromMonth === 'PREVIOUS' && firstOfMonthIdx) {
        elRefs.current[firstOfMonthIdx.week][firstOfMonthIdx.day].current.focus();
      } else if (cameFromMonth === 'NEXT' && lastOfMonthIdx) {
        elRefs.current[lastOfMonthIdx.week][lastOfMonthIdx.day].current.focus();
      } else {
        if (selectedIdx) {
          elRefs.current[selectedIdx.week][selectedIdx.day].current.focus();
        } else if (todayIdx) {
          elRefs.current[todayIdx.week][todayIdx.day].current.focus();
        } else if (firstOfMonthIdx) {
          elRefs.current[firstOfMonthIdx.week][firstOfMonthIdx.day].current.focus();
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateGrid, elRefs.current]);

  // Calculate date grid for a 5 week period
  useEffect(() => {
    let date: moment.Moment;
    if (isNumber(currMonth) && isNumber(currYear)) {
      date = moment().month(currMonth).year(currYear).startOf('month');
    } else {
      date = moment().startOf('month');
    }
    // Set date to sunday of current week, which is likely in prior month
    const startDate = date.clone().day(0);
    // set end date to show a full 5 weeks from start date
    const endDate = startDate.clone().add(6, 'weeks').subtract(1, 'day');

    const today = moment();
    const currDate = startDate.clone();
    const grid: DateGridDate[][] = [];
    let currWeek: DateGridDate[] = [];
    let isFirstIteration = true;
    // create grid
    while (currDate.isSameOrBefore(endDate, 'day')) {
      if (!isFirstIteration && currDate.day() === 0) {
        grid.push(currWeek);
        currWeek = [];
      }
      isFirstIteration = false;
      currWeek.push({
        label: currDate.date(),
        value: currDate.clone(),
        isCurrMonth: currDate.month() === currMonth,
        isToday: currDate.isSame(today, 'day'),
        isSelected: selectedDate && selectedDate.isSame(currDate, 'day'),
      });
      currDate.add(1, 'day');
    }
    setDateGrid(grid);
  }, [selectedDate, currMonth, currYear]);

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

    if (event.key === 'Escape' || event.keyCode === 27) {
      onClose();
      return;
    }

    if (event.key === 'Enter' || event.keyCode === 13 || event.keyCode === 32) {
      onSelected(day.value);
      return;
    }

    if (event.altKey || event.ctrlKey || event.metaKey) {
      if (event.key === 'ArrowUp' || event.keyCode === 38) {
        return onPrevYear();
      } else if (event.key === 'ArrowDown' || event.keyCode === 40) {
        return onNextYear();
      }
    }

    if (event.key === 'PageUp' || event.keyCode === 33) {
      return onPrevMonth();
    } else if (event.key === 'PageDown' || event.keyCode === 34) {
      return onNextMonth();
    } else if (event.key === 'Home' || event.keyCode === 36) {
      targetWeekIdx = weekIdx;
      targetDayIdx = 0;
    } else if (event.key === 'End' || event.keyCode === 35) {
      targetWeekIdx = weekIdx;
      targetDayIdx = currentRefs[weekIdx].length - 1;
    } else if (event.key === 'ArrowLeft' || event.keyCode === 37) {
      if (dayIdx === 0) {
        targetWeekIdx = weekIdx;
        targetDayIdx = currentRefs[weekIdx].length - 1;
      } else {
        targetWeekIdx = weekIdx;
        targetDayIdx = dayIdx - 1;
      }
    } else if (event.key === 'ArrowUp' || event.keyCode === 38) {
      if (weekIdx === 0) {
        return onPrevMonth();
      } else {
        targetWeekIdx = weekIdx - 1;
        targetDayIdx = dayIdx;
      }
    } else if (event.key === 'ArrowRight' || event.keyCode === 39) {
      if (dayIdx === currentRefs[weekIdx].length - 1) {
        targetWeekIdx = weekIdx;
        targetDayIdx = 0;
      } else {
        targetWeekIdx = weekIdx;
        targetDayIdx = dayIdx + 1;
      }
    } else if (event.key === 'ArrowDown' || event.keyCode === 40) {
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
      if (newDay.isSame(day.value, 'month')) {
        currentRefs[targetWeekIdx][targetDayIdx].current.focus();
      } else if (newDay.isBefore(day.value)) {
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
                    'slds-day_adjacent-month': !day.isCurrMonth,
                    'slds-is-today': day.isToday,
                  })}
                  role="gridcell"
                  tabIndex={day.label === 1 && day.isCurrMonth ? 0 : -1}
                  onClick={() => onSelected(day.value)}
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
