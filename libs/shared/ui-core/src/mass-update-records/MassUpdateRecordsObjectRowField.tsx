import { css } from '@emotion/react';
import { Field, ListItem, Maybe } from '@jetstream/types';
import { ComboboxWithItems, Grid, Icon } from '@jetstream/ui';
import { FunctionComponent } from 'react';

export interface MassUpdateRecordsObjectRowFieldProps {
  /** Deterministic id for the combobox input, so the parent can move focus to a specific row */
  comboboxId?: string;
  fields: ListItem[];
  selectedField?: Maybe<string>;
  disabled?: boolean;
  allowDelete?: boolean;
  onchange: (selectedField: string, fieldMetadata: Field) => void;
  onRemoveRow: () => void;
}

export const MassUpdateRecordsObjectRowField: FunctionComponent<MassUpdateRecordsObjectRowFieldProps> = ({
  comboboxId,
  fields,
  selectedField,
  disabled,
  allowDelete,
  onchange,
  onRemoveRow,
}) => {
  function handleFieldSelection(item: ListItem) {
    onchange(item.id, item.meta as Field);
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
            inputProps: comboboxId ? { id: comboboxId } : undefined,
          }}
          items={fields}
          selectedItemId={selectedField}
          onSelected={handleFieldSelection}
        />
      </div>
      {allowDelete && (
        <button
          className="slds-button slds-button_icon slds-button_icon-border slds-button_icon-error"
          title="Delete field mapping"
          disabled={disabled}
          onClick={() => onRemoveRow()}
        >
          <Icon type="utility" icon="delete" className="slds-button__icon" omitContainer />
          <span className="slds-assistive-text">Delete Mapping</span>
        </button>
      )}
    </Grid>
  );
};

export default MassUpdateRecordsObjectRowField;
