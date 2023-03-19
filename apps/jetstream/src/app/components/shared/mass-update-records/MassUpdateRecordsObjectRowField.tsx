import { css } from '@emotion/react';
import { ListItem, Maybe } from '@jetstream/types';
import { ComboboxWithItems, Grid } from '@jetstream/ui';
import { FunctionComponent } from 'react';

export interface MassUpdateRecordsObjectRowFieldProps {
  fields: ListItem[];
  selectedField?: Maybe<string>;
  disabled?: boolean;
  onchange: (selectedField: string) => void;
}

export const MassUpdateRecordsObjectRowField: FunctionComponent<MassUpdateRecordsObjectRowFieldProps> = ({
  fields,
  selectedField,
  disabled,
  onchange,
}) => {
  function handleFieldSelection(item: ListItem) {
    onchange(item.id);
  }

  return (
    <Grid
      verticalAlign="end"
      css={css`
        min-width: 240px;
      `}
    >
      <div className="slds-m-horizontal_x-small slds-grow">
        <ComboboxWithItems
          comboboxProps={{
            label: 'Field to Update',
            itemLength: 5,
            isRequired: true,
            disabled,
          }}
          items={fields}
          selectedItemId={selectedField}
          onSelected={handleFieldSelection}
        />
      </div>
    </Grid>
  );
};

export default MassUpdateRecordsObjectRowField;
