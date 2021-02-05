/** @jsx jsx */
// https://www.lightningdesignsystem.com/components/input/#Fixed-Text
import { jsx } from '@emotion/react';
import { FunctionComponent, useEffect, useState } from 'react';
import Icon from '../../widgets/Icon';

export interface DateGridPrevNextSelectorProps {
  id: string;
  currMonth: string;
  currYear?: number;
  availableYears: number[];
  prevMonthAvailable: boolean;
  nextMonthAvailable: boolean;
  onPrev: () => void;
  onNext: () => void;
  onYearChange: (year: number) => void;
}

export const DateGridPrevNextSelector: FunctionComponent<DateGridPrevNextSelectorProps> = ({
  id = 'date-picker',
  currMonth,
  currYear,
  availableYears,
  prevMonthAvailable,
  nextMonthAvailable,
  onPrev,
  onNext,
  onYearChange,
}) => {
  const [year, setYear] = useState(currYear || new Date().getFullYear());

  useEffect(() => {
    if (currYear) {
      setYear(currYear);
    }
  }, [currYear]);

  return (
    <div className="slds-datepicker__filter slds-grid">
      <div className="slds-datepicker__filter_month slds-grid slds-grid_align-spread slds-grow">
        <div className="slds-align-middle">
          <button
            className="slds-button slds-button_icon slds-button_icon-container"
            title="Previous Month"
            onClick={() => onPrev()}
            disabled={!prevMonthAvailable}
          >
            <Icon omitContainer type="utility" icon="left" description="Previous Month" className="slds-button__icon" />
          </button>
        </div>
        <h2 aria-atomic="true" aria-live="assertive" className="slds-align-middle" id={id}>
          {currMonth}
        </h2>
        <div className="slds-align-middle">
          <button
            className="slds-button slds-button_icon slds-button_icon-container"
            title="Next Month"
            onClick={() => onNext()}
            disabled={!nextMonthAvailable}
          >
            <Icon omitContainer type="utility" icon="right" description="Next Month" className="slds-button__icon" />
          </button>
        </div>
      </div>
      <div className="slds-shrink-none">
        <label className="slds-assistive-text" htmlFor={`${id}-select`}>
          Pick a Year
        </label>
        <div className="slds-select_container">
          <select
            className="slds-select"
            id={`${id}-select`}
            value={`${year}`}
            onChange={(event) => {
              setYear(Number(event.target.value));
              onYearChange(Number(event.target.value));
            }}
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
};

export default DateGridPrevNextSelector;
