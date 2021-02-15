/** @jsx jsx */
import { jsx } from '@emotion/react';
import { RadioButton, RadioGroup } from '@jetstream/ui';
import { FunctionComponent } from 'react';

export interface QueryHistoryWhichTypeProps {
  which: 'HISTORY' | 'SAVED';
  onChange: (value: 'HISTORY' | 'SAVED') => void;
}

export const QueryHistoryWhichType: FunctionComponent<QueryHistoryWhichTypeProps> = ({ which, onChange }) => {
  return (
    <RadioGroup isButtonGroup>
      <RadioButton
        id="query-history"
        name="query-history"
        label="Query History"
        value="HISTORY"
        checked={which === 'HISTORY'}
        onChange={(value) => onChange(value as 'HISTORY' | 'SAVED')}
      />
      <RadioButton
        id="query-history-saved"
        name="query-history"
        label="Saved Queries"
        value="SAVED"
        checked={which === 'SAVED'}
        onChange={(value) => onChange(value as 'HISTORY' | 'SAVED')}
      />
    </RadioGroup>
  );
};

export default QueryHistoryWhichType;
