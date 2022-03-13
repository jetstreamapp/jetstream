import { css } from '@emotion/react';
import { ListItem } from '@jetstream/types';
import { ComboboxWithItems, Grid } from '@jetstream/ui';
import { FunctionComponent } from 'react';

export interface MassUpdateRecordsObjectRowFieldProps {
  fields: ListItem[];
  selectedField?: string;
  onchange: (selectedField: string) => void;
}

export const MassUpdateRecordsObjectRowField: FunctionComponent<MassUpdateRecordsObjectRowFieldProps> = ({
  fields,
  selectedField,
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
            itemLength: 10,
            isRequired: true,
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
