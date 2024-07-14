import { css } from '@emotion/react';
import { AllUser } from '@jetstream/types';
import { DatePicker, Grid } from '@jetstream/ui';
import { fromDeployMetadataState } from '@jetstream/ui-core';
import { addDays } from 'date-fns/addDays';
import { isAfter } from 'date-fns/isAfter';
import { isSameDay } from 'date-fns/isSameDay';
import { Fragment, FunctionComponent, useEffect, useState } from 'react';
import { useRecoilState } from 'recoil';
import { RadioButtonItem, RadioButtonSelection } from './RadioButtonSelection';

const DATE_RANGE_RADIO_BUTTONS: RadioButtonItem<AllUser>[] = [
  {
    name: 'all',
    label: 'Any Date',
    value: 'all',
  },
  {
    name: 'user',
    label: 'Specific Date',
    value: 'user',
  },
];
export interface DateSelectionProps {
  requireConfirmSelection?: boolean;
  onSubmit?: () => void;
}

export interface DateSelectionRequireSelectionProps extends DateSelectionProps {
  requireConfirmSelection: true;
  onSubmit: () => void;
}

export const DateSelection: FunctionComponent<DateSelectionProps | DateSelectionRequireSelectionProps> = ({
  requireConfirmSelection,
  onSubmit,
}) => {
  const [maxDate] = useState(() => addDays(new Date(), 1));
  const [isValid, setIsValid] = useState(true);

  const [_dateRangeSelection, _setDateRangeSelection] = useRecoilState<AllUser>(fromDeployMetadataState.dateRangeSelectionState);
  const [_dateRangeStart, _setDateRangeStart] = useRecoilState<Date | null>(fromDeployMetadataState.dateRangeStartState);
  const [_dateRangeEnd, _setDateRangeEnd] = useRecoilState<Date | null>(fromDeployMetadataState.dateRangeEndState);

  const [dateRangeSelection, setDateRangeSelection] = useState(_dateRangeSelection);
  const [dateRangeStart, setDateRangeStart] = useState(_dateRangeStart);
  const [dateRangeEnd, setDateRangeEnd] = useState(_dateRangeEnd);

  useEffect(() => {
    if (dateRangeSelection && !dateRangeStart && !dateRangeEnd) {
      setIsValid(false);
    } else if (
      dateRangeSelection &&
      dateRangeStart &&
      dateRangeEnd &&
      (isSameDay(dateRangeStart, dateRangeEnd) || isAfter(dateRangeStart, dateRangeEnd))
    ) {
      setIsValid(false);
    } else {
      setIsValid(true);
    }
  }, [dateRangeSelection, dateRangeStart, dateRangeEnd]);

  useEffect(() => {
    if (!requireConfirmSelection) {
      _setDateRangeSelection(dateRangeSelection);
    }
  }, [dateRangeSelection]);

  useEffect(() => {
    if (!requireConfirmSelection) {
      _setDateRangeStart(dateRangeStart);
    }
  }, [dateRangeStart]);

  useEffect(() => {
    if (!requireConfirmSelection) {
      _setDateRangeEnd(dateRangeEnd);
    }
  }, [dateRangeEnd]);

  function handleSubmit() {
    _setDateRangeSelection(dateRangeSelection);
    _setDateRangeStart(dateRangeStart);
    _setDateRangeEnd(dateRangeEnd);
    onSubmit && onSubmit();
  }

  return (
    <Fragment>
      {requireConfirmSelection && (
        <Grid align="center">
          <button className="slds-button slds-button_brand" onClick={handleSubmit} disabled={!isValid}>
            Submit
          </button>
        </Grid>
      )}
      <div className="slds-align_absolute-center">
        <RadioButtonSelection
          label={'Show metadata created or changed since'}
          items={DATE_RANGE_RADIO_BUTTONS}
          checkedValue={dateRangeSelection}
          onChange={(value) => setDateRangeSelection(value as AllUser)}
        />
      </div>
      <div
        key="modified-since"
        css={css`
          min-height: 80px;
        `}
      >
        {dateRangeSelection === 'user' && (
          <Fragment>
            <DatePicker
              id="modified-start"
              label="Modified After"
              className="slds-m-top_small slds-form-element_stacked slds-is-editing"
              maxAvailableDate={maxDate}
              errorMessage="Choose a valid date in the past"
              labelHelp="All metadata items that were created or modified on or after this date will be shown"
              hasError={false}
              errorMessageId={`modified-start-error`}
              initialSelectedDate={dateRangeStart || undefined}
              onChange={setDateRangeStart}
            />
            <DatePicker
              id="modified-end"
              label="Modified Before"
              className="slds-m-top_small slds-form-element_stacked slds-is-editing"
              maxAvailableDate={maxDate}
              errorMessage="Choose a valid date in the past"
              labelHelp="All metadata items that were created or modified on or before this date will be shown"
              hasError={false}
              errorMessageId={`modified-end-error`}
              initialSelectedDate={dateRangeEnd || undefined}
              onChange={setDateRangeEnd}
            />
          </Fragment>
        )}
      </div>
    </Fragment>
  );
};

export default DateSelection;
