import { css } from '@emotion/react';
import { Icon, RadioButton, RadioGroup } from '@jetstream/ui';
import { FunctionComponent } from 'react';
import { fromQueryHistoryState } from '../..';

export interface QueryHistoryWhichTypeProps {
  which: fromQueryHistoryState.QueryHistoryType;
  onChange: (value: fromQueryHistoryState.QueryHistoryType) => void;
}

// SLDS 2's radio button-group label (`slds-radio_faux`) is not a flex container,
// unlike `.slds-button` (which is `inline-flex; align-items: center`). An inline
// icon in the label therefore aligns to the text baseline and sits slightly high.
// Wrapping the content in an inline-flex row reuses the exact centering a real
// button applies, so these toggle icons line up like every other button icon.
const labelCss = css`
  display: inline-flex;
  align-items: center;
`;

export const QueryHistoryWhichType: FunctionComponent<QueryHistoryWhichTypeProps> = ({ which, onChange }) => {
  return (
    <RadioGroup isButtonGroup>
      <RadioButton
        id="query-history"
        name="query-history"
        label={
          <span css={labelCss}>
            <Icon type="utility" icon="date_time" description="Manually enter query" className="slds-button__icon slds-button__icon_left" />
            History
          </span>
        }
        value="HISTORY"
        checked={which === 'HISTORY'}
        onChange={(value) => onChange(value as fromQueryHistoryState.QueryHistoryType)}
      />
      <RadioButton
        id="query-history-saved"
        name="query-history"
        label={
          <span css={labelCss}>
            <Icon type="utility" icon="favorite" description="Manually enter query" className="slds-button__icon slds-button__icon_left" />
            Saved Queries
          </span>
        }
        value="SAVED"
        checked={which === 'SAVED'}
        onChange={(value) => onChange(value as fromQueryHistoryState.QueryHistoryType)}
      />
    </RadioGroup>
  );
};

export default QueryHistoryWhichType;
