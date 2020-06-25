/** @jsx jsx */
// https://www.lightningdesignsystem.com/components/input/#Fixed-Text
import { jsx } from '@emotion/core';
import classNames from 'classnames';
import moment from 'moment-mini';
import { FunctionComponent, useEffect, useState } from 'react';
import { isNumber } from 'lodash';

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
  onSelected: (date: moment.Moment) => void;
}

export const DateGrid: FunctionComponent<DateGridProps> = ({ currMonth, currYear, selectedDate, onSelected }) => {
  const [dateGrid, setDateGrid] = useState<DateGridDate[][]>([]);

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
        {dateGrid.map((week) => (
          <tr>
            {week.map((day) => (
              <td
                aria-selected={day.isSelected}
                className={classNames({
                  'slds-is-selected': day.isSelected,
                  'slds-day_adjacent-month': !day.isCurrMonth,
                  'slds-is-today': day.isToday,
                })}
                role="gridcell"
                tabIndex={day.label === 1 && day.isCurrMonth ? 0 : undefined}
                onClick={() => onSelected(day.value)}
              >
                <span className="slds-day">{day.label}</span>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default DateGrid;
