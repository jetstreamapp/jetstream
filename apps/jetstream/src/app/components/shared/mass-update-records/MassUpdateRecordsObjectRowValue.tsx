import { css } from '@emotion/react';
import { Field, ListItem, Maybe } from '@jetstream/types';
import { ComboboxWithDrillInItems, ComboboxWithItems, Grid } from '@jetstream/ui';
import { FunctionComponent, useMemo } from 'react';
import { MassUpdateRecordsObjectRowValueStaticInput } from './MassUpdateRecordsObjectRowValueStaticInput';
import { TransformationOption, TransformationOptions } from './mass-update-records.types';
import { transformationOptionListItems } from './mass-update-records.utils';

export interface MassUpdateRecordsObjectRowValueProps {
  sobject: string;
  fields: ListItem[];
  selectedField?: Maybe<string>;
  transformationOptions: TransformationOptions;
  disabled?: boolean;
  onOptionsChange: (options: TransformationOptions) => void;
  onLoadChildFields?: (item: ListItem) => Promise<ListItem[]>;
}

export const MassUpdateRecordsObjectRowValue: FunctionComponent<MassUpdateRecordsObjectRowValueProps> = ({
  sobject,
  fields,
  selectedField: selectedFieldId,
  transformationOptions,
  disabled,
  onOptionsChange,
  onLoadChildFields,
}) => {
  const selectedField = useMemo<Maybe<Field>>(() => fields.find((field) => field.id === selectedFieldId)?.meta, [fields, selectedFieldId]);

  function handleUpdateToApply(option: TransformationOption) {
    onOptionsChange({ ...transformationOptions, option });
  }

  function handleStaticValueChanged(staticValue: string) {
    onOptionsChange({ ...transformationOptions, staticValue });
  }

  function handleAlternateFieldChange(alternateField: Maybe<string>) {
    onOptionsChange({ ...transformationOptions, alternateField });
  }

  return (
    <Grid className="slds-grow" verticalAlign="end">
      <Grid verticalAlign="end" className="text-bold slds-m-horizontal_medium slds-m-bottom_x-small">
        NEW VALUE
      </Grid>
      <Grid className="slds-grow" wrap>
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
          <Grid verticalAlign="end">
            <MassUpdateRecordsObjectRowValueStaticInput
              selectedField={selectedField}
              value={transformationOptions.staticValue}
              disabled={disabled}
              onChange={handleStaticValueChanged}
            />
          </Grid>
        )}
        {transformationOptions.option === 'anotherField' && (
          <Grid
            className="slds-grow"
            verticalAlign="end"
            css={css`
              min-width: 240px;
            `}
          >
            <div className="slds-m-horizontal_x-small slds-grow">
              <ComboboxWithDrillInItems
                comboboxProps={{
                  label: 'Field to use as value',
                  itemLength: 7,
                  isRequired: true,
                  showSelectionAsButton: true,
                  labelHelp: 'Each record will be updated with the value from this field',
                  disabled,
                  onClear: () => handleAlternateFieldChange(null),
                }}
                items={fields}
                rootHeadingLabel={sobject}
                selectedItemLabelFn={(item) => item.value}
                selectedItemId={transformationOptions.alternateField}
                onSelected={(item) => handleAlternateFieldChange(item?.id)}
                onLoadItems={onLoadChildFields}
              />
            </div>
          </Grid>
        )}
      </Grid>
    </Grid>
  );
};

export default MassUpdateRecordsObjectRowValue;
