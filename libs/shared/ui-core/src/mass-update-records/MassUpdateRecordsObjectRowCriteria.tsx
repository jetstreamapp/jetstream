import { css } from '@emotion/react';
import { useDebounce } from '@jetstream/shared/ui-utils';
import { ListItem } from '@jetstream/types';
import { ComboboxWithItems, ControlledTextarea, Grid, Textarea } from '@jetstream/ui';
import { isQueryValid } from '@jetstreamapp/soql-parser-js';
import { FunctionComponent, useEffect, useState } from 'react';
import { TransformationCriteria, TransformationOptions } from './mass-update-records.types';
import { startsWithWhereRgx, transformationCriteriaListItems } from './mass-update-records.utils';

export interface MassUpdateRecordsObjectRowCriteriaProps {
  sobject: string;
  transformationOptions: TransformationOptions;
  disabled?: boolean;
  filterFn?: (item: ListItem) => boolean;
  onOptionsChange: (options: TransformationOptions) => void;
}

export const MassUpdateRecordsObjectRowCriteria: FunctionComponent<MassUpdateRecordsObjectRowCriteriaProps> = ({
  sobject,
  transformationOptions,
  disabled,
  filterFn = () => true,
  onOptionsChange,
}) => {
  const debouncedWhereClause = useDebounce(transformationOptions?.whereClause || '', 300);
  const [whereClauseIsValid, setWhereClauseIsValid] = useState(true);

  useEffect(() => {
    if (debouncedWhereClause) {
      const whereClause = debouncedWhereClause.replace(startsWithWhereRgx, '');
      setWhereClauseIsValid(isQueryValid(`WHERE ${whereClause}`, { allowPartialQuery: true }));
    }
  }, [debouncedWhereClause]);

  function handleUpdateToApply(criteria: TransformationCriteria) {
    onOptionsChange({ ...transformationOptions, criteria });
  }

  function handleWhereClauseChanged(whereClause: string) {
    onOptionsChange({ ...transformationOptions, whereClause });
  }

  return (
    <Grid verticalAlign="end">
      <Grid verticalAlign="end" className="text-bold slds-m-horizontal_medium slds-m-bottom_x-small">
        CRITERIA
      </Grid>
      <Grid wrap className="slds-grow">
        <Grid
          verticalAlign="end"
          css={css`
            min-width: 240px;
          `}
        >
          <div className="slds-m-horizontal_x-small slds-grow">
            <ComboboxWithItems
              comboboxProps={{
                label: 'Which records should be updated?',
                itemLength: 5,
                isRequired: true,
                disabled,
              }}
              items={transformationCriteriaListItems.filter(filterFn)}
              selectedItemId={transformationOptions.criteria}
              onSelected={(item) => handleUpdateToApply(item.id as TransformationCriteria)}
            />
          </div>
        </Grid>
        {transformationOptions.criteria === 'custom' && (
          <Grid
            className="slds-grow"
            verticalAlign="end"
            css={css`
              min-width: 240px;
            `}
          >
            <div className="slds-m-horizontal_x-small slds-grow">
              <Textarea
                id={`${sobject}-criteria`}
                label="Custom WHERE clause"
                isRequired
                labelHelp="Provide a custom SOQL WHERE clause to target the specific records that you would like to update"
                hasError={!whereClauseIsValid}
                errorMessage="Not a valid WHERE clause"
                errorMessageId={`${sobject}-criteria-error`}
              >
                <ControlledTextarea
                  id={`${sobject}-criteria`}
                  className="slds-input"
                  placeholder="CreatedDate >= THIS_WEEK AND Type__c != 'Account'"
                  rows={1}
                  disabled={disabled}
                  value={transformationOptions.whereClause}
                  onChange={(event) => handleWhereClauseChanged(event.target.value)}
                />
              </Textarea>
            </div>
          </Grid>
        )}
      </Grid>
    </Grid>
  );
};

export default MassUpdateRecordsObjectRowCriteria;
