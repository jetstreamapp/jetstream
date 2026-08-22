import { css } from '@emotion/react';
import { useIntegerInput } from '@jetstream/shared/ui-utils';
import { Maybe } from '@jetstream/types';
import { Grid, Input } from '@jetstream/ui';
import { FunctionComponent } from 'react';
import { RecordLimitAndOffset } from './mass-update-records.types';
import { getRecordLimitError, getRecordOffsetError, MAX_SOQL_OFFSET } from './mass-update-records.utils';

export interface MassUpdateRecordsObjectRowLimitProps {
  sobject: string;
  limit: Maybe<number>;
  offset: Maybe<number>;
  disabled?: boolean;
  onChange: (limitAndOffset: RecordLimitAndOffset) => void;
}

/**
 * Optional per-object `LIMIT` / `OFFSET`, which allows updating a data volume that is too large to
 * process in one pass by working through it a chunk at a time.
 */
export const MassUpdateRecordsObjectRowLimit: FunctionComponent<MassUpdateRecordsObjectRowLimitProps> = ({
  sobject,
  limit,
  offset,
  disabled,
  onChange,
}) => {
  const limitInput = useIntegerInput(limit, (newLimit) => onChange({ limit: newLimit, offset }));
  const offsetInput = useIntegerInput(offset, (newOffset) => onChange({ limit, offset: newOffset }));

  const limitError = getRecordLimitError(limit);
  const offsetError = getRecordOffsetError(offset);

  return (
    <Grid verticalAlign="end">
      <Grid verticalAlign="end" className="text-bold slds-m-horizontal_medium slds-m-bottom_x-small">
        LIMIT
      </Grid>
      <Grid
        wrap
        className="slds-grow"
        css={css`
          max-width: 500px;
        `}
      >
        <Grid
          verticalAlign="end"
          css={css`
            min-width: 240px;
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
        <Grid
          verticalAlign="end"
          css={css`
            min-width: 240px;
          `}
        >
          <div className="slds-m-horizontal_x-small slds-grow">
            <Input
              id={`${sobject}-offset`}
              label="Skip records"
              hasError={!!offsetError}
              errorMessage={offsetError}
              errorMessageId={`${sobject}-offset-error`}
              labelHelp={`Skip this many records before updating, which is useful for working through a large data volume in chunks. Salesforce does not allow skipping more than ${MAX_SOQL_OFFSET.toLocaleString()} records.`}
            >
              <input
                id={`${sobject}-offset`}
                className="slds-input"
                placeholder="Skip no records"
                value={offsetInput.inputValue}
                aria-describedby={offsetError ? `${sobject}-offset-error` : undefined}
                disabled={disabled}
                onChange={offsetInput.handleChange}
                onBlur={offsetInput.handleBlur}
              />
            </Input>
          </div>
        </Grid>
      </Grid>
    </Grid>
  );
};

export default MassUpdateRecordsObjectRowLimit;
