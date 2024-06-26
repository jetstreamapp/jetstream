import { Icon, RadioButton, RadioGroup } from '@jetstream/ui';
import { fromQueryHistoryState } from '@jetstream/ui-core';
import { Fragment, FunctionComponent } from 'react';

export interface QueryHistoryWhichTypeProps {
  which: fromQueryHistoryState.QueryHistoryType;
  onChange: (value: fromQueryHistoryState.QueryHistoryType) => void;
}

export const QueryHistoryWhichType: FunctionComponent<QueryHistoryWhichTypeProps> = ({ which, onChange }) => {
  return (
    <RadioGroup isButtonGroup>
      <RadioButton
        id="query-history"
        name="query-history"
        label={
          <Fragment>
            <Icon type="utility" icon="date_time" description="Manually enter query" className="slds-button__icon slds-button__icon_left" />
            History
          </Fragment>
        }
        value="HISTORY"
        checked={which === 'HISTORY'}
        onChange={(value) => onChange(value as fromQueryHistoryState.QueryHistoryType)}
      />
      <RadioButton
        id="query-history-saved"
        name="query-history"
        label={
          <Fragment>
            <Icon type="utility" icon="favorite" description="Manually enter query" className="slds-button__icon slds-button__icon_left" />
            Saved Queries
          </Fragment>
        }
        value="SAVED"
        checked={which === 'SAVED'}
        onChange={(value) => onChange(value as fromQueryHistoryState.QueryHistoryType)}
      />
    </RadioGroup>
  );
};

export default QueryHistoryWhichType;
