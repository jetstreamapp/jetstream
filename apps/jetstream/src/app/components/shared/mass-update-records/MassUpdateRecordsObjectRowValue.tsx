import { css } from '@emotion/react';
import { ListItem } from '@jetstream/types';
import { ComboboxWithItems, ControlledInput, Grid, Input } from '@jetstream/ui';
import { FunctionComponent } from 'react';
import { TransformationOption, TransformationOptions } from './mass-update-records.types';
import { transformationOptionListItems } from './mass-update-records.utils';

export interface MassUpdateRecordsObjectRowValueProps {
  fields: ListItem[];
  transformationOptions: TransformationOptions;
  disabled?: boolean;
  onOptionsChange: (options: TransformationOptions) => void;
}

export const MassUpdateRecordsObjectRowValue: FunctionComponent<MassUpdateRecordsObjectRowValueProps> = ({
  fields,
  transformationOptions,
  disabled,
  onOptionsChange,
}) => {
  function handleUpdateToApply(option: TransformationOption) {
    onOptionsChange({ ...transformationOptions, option });
  }

  function handleStaticValueChanged(staticValue: string) {
    onOptionsChange({ ...transformationOptions, staticValue });
  }

  function handleAlternateFieldChange(alternateField: string) {
    onOptionsChange({ ...transformationOptions, alternateField });
  }

  return (
    <Grid verticalAlign="end">
      <Grid verticalAlign="end" className="text-bold slds-m-horizontal_medium slds-m-bottom_x-small">
        NEW VALUE
      </Grid>
      <Grid wrap>
        <Grid
          verticalAlign="end"
          css={css`
            min-width: 240px;
          `}
        >
          <div className="slds-m-horizontal_x-small slds-grow">
            <ComboboxWithItems
              comboboxProps={{
                label: 'Record update to Apply',
                itemLength: 5,
                isRequired: true,
                disabled,
              }}
              items={transformationOptionListItems}
              selectedItemId={transformationOptions.option}
              onSelected={(item) => handleUpdateToApply(item.id as TransformationOption)}
            />
          </div>
        </Grid>
        {transformationOptions.option === 'staticValue' && (
          <div>
            <Grid
              verticalAlign="end"
              css={css`
                min-width: 240px;
              `}
            >
              <div className="slds-m-horizontal_x-small slds-grow">
                <Input label="Provided Value" isRequired>
                  <ControlledInput
                    className="slds-input"
                    placeholder="Value to set on each record"
                    value={transformationOptions.staticValue}
                    disabled={disabled}
                    onChange={(event) => handleStaticValueChanged(event.target.value)}
                  />
                </Input>
              </div>
            </Grid>
          </div>
        )}
        {transformationOptions.option === 'anotherField' && (
          <Grid
            verticalAlign="end"
            css={css`
              min-width: 240px;
            `}
          >
            <div className="slds-m-horizontal_x-small slds-grow">
              <ComboboxWithItems
                comboboxProps={{
                  label: 'Field to use as value',
                  itemLength: 5,
                  isRequired: true,
                  labelHelp: 'Each record will be updated with the value from this field',
                  disabled,
                }}
                items={fields}
                selectedItemId={transformationOptions.alternateField}
                onSelected={(item) => handleAlternateFieldChange(item.id)}
              />
            </div>
          </Grid>
        )}
      </Grid>
    </Grid>
  );
};

export default MassUpdateRecordsObjectRowValue;
