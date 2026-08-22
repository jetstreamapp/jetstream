import { css } from '@emotion/react';
import { useIntegerInput } from '@jetstream/shared/ui-utils';
import { Maybe } from '@jetstream/types';
import { Grid, Input } from '@jetstream/ui';
import { FunctionComponent } from 'react';
import { getRecordLimitError } from './mass-update-records.utils';

export interface MassUpdateRecordsObjectRowLimitProps {
  sobject: string;
  limit: Maybe<number>;
  disabled?: boolean;
  onChange: (limit: Maybe<number>) => void;
}

/**
 * Optional per-object `LIMIT`, which allows updating a data volume that is too large to process in
 * one pass by working through it a chunk at a time.
 */
export const MassUpdateRecordsObjectRowLimit: FunctionComponent<MassUpdateRecordsObjectRowLimitProps> = ({
  sobject,
  limit,
  disabled,
  onChange,
}) => {
  const limitInput = useIntegerInput(limit, onChange);
  const limitError = getRecordLimitError(limit);

  return (
    <Grid verticalAlign="end">
      <Grid verticalAlign="end" className="text-bold slds-m-horizontal_medium slds-m-bottom_x-small">
        LIMIT
      </Grid>
      <Grid
        verticalAlign="end"
        css={css`
          min-width: 240px;
          max-width: 500px;
        `}
      >
        <div className="slds-m-horizontal_x-small slds-grow">
          <Input
            id={`${sobject}-limit`}
            label="Maximum records to update"
            hasError={!!limitError}
            errorMessage={limitError}
            errorMessageId={`${sobject}-limit-error`}
            labelHelp="Limit how many records are updated at one time. Leave blank to update every record that meets your criteria."
          >
            <input
              id={`${sobject}-limit`}
              className="slds-input"
              placeholder="All matching records"
              value={limitInput.inputValue}
              aria-describedby={limitError ? `${sobject}-limit-error` : undefined}
              disabled={disabled}
              onChange={limitInput.handleChange}
              onBlur={limitInput.handleBlur}
            />
          </Input>
        </div>
      </Grid>
    </Grid>
  );
};

export default MassUpdateRecordsObjectRowLimit;
