import { css } from '@emotion/react';
import { Field, ListItem, Maybe } from '@jetstream/types';
import { ControlledInput, DatePicker, DateTime, DropDown, Grid, Input, Picklist } from '@jetstream/ui';
import { formatISO } from 'date-fns/formatISO';
import { FunctionComponent, useMemo, useState } from 'react';

const manualInputTypes = new Set(['date', 'datetime', 'boolean', 'picklist', 'multipicklist']);

const booleanValues: ListItem[] = [
  { id: 'true', label: 'True', value: 'true' },
  { id: 'false', label: 'False', value: 'false' },
];

export interface MassUpdateRecordsObjectRowValueStaticInputProps {
  selectedField?: Maybe<Field>;
  value: string;
  disabled?: boolean;
  onChange: (value: string) => void;
}

export const MassUpdateRecordsObjectRowValueStaticInput: FunctionComponent<MassUpdateRecordsObjectRowValueStaticInputProps> = (props) => {
  const { disabled, selectedField } = props;
  const [useManualInput, setUseManualInput] = useState(false);

  const showManualInputToggle = selectedField && manualInputTypes.has(selectedField.type);

  const isPicklist = selectedField && (selectedField.type === 'picklist' || selectedField.type === 'multipicklist');

  const picklistItems = useMemo(() => {
    if (!isPicklist || !Array.isArray(selectedField.picklistValues)) {
      return [];
    }
    return selectedField.picklistValues.map((item): ListItem => {
      const secondaryLabel = item.label !== item.value ? item.value : undefined;
      return {
        id: item.value,
        label: item.label || item.value,
        value: item.value,
        secondaryLabel: secondaryLabel,
        secondaryLabelOnNewLine: !!secondaryLabel,
        meta: item,
      };
    });
  }, [isPicklist, selectedField]);

  return (
    <Grid verticalAlign="end">
      <StaticInputContent useManualInput={useManualInput} picklistItems={picklistItems} {...props} />
      {showManualInputToggle && (
        <DropDown
          className="slds-button_last"
          dropDownClassName="slds-dropdown_actions"
          position="right"
          items={[{ id: 'manual-toggle', value: useManualInput ? 'Use Automatic Input' : 'Use Text Input' }]}
          disabled={disabled}
          onSelected={(item) => setUseManualInput(!useManualInput)}
        />
      )}
    </Grid>
  );
};

export const StaticInputContent: FunctionComponent<
  MassUpdateRecordsObjectRowValueStaticInputProps & { useManualInput: boolean; picklistItems: ListItem[] }
> = ({ disabled, picklistItems, selectedField, useManualInput, value, onChange }) => {
  if (!useManualInput && selectedField?.type === 'date') {
    return (
      <DatePicker
        id="static-value-date"
        label="Provided Value"
        className="slds-m-right_x-small slds-grow"
        isRequired
        usePortal
        disabled={disabled}
        onChange={(value) => onChange(value ? formatISO(value, { representation: 'date' }) : '')}
      />
    );
  }

  if (!useManualInput && selectedField?.type === 'datetime') {
    return (
      <DateTime
        dateProps={{
          id: 'static-value-date',
          label: 'Provided Value',
          isRequired: true,
          disabled,
          usePortal: true,
        }}
        timeProps={{
          label: 'Time',
          stepInMinutes: 1,
          disabled,
        }}
        rowContainerClassName="slds-grid"
        onChange={(value) => onChange(value || '')}
      />
    );
  }

  if (!useManualInput && selectedField?.type === 'boolean') {
    return (
      <Picklist
        label="Provided Value"
        className="slds-m-right_x-small slds-grow"
        items={booleanValues}
        selectedItemIds={[value]}
        isRequired
        scrollLength={10}
        disabled={disabled}
        onChange={(values) => onChange(values?.[0]?.id === 'true' ? 'true' : 'false')}
      ></Picklist>
    );
  }

  if (!useManualInput && (selectedField?.type === 'picklist' || selectedField?.type === 'multipicklist')) {
    return (
      <Picklist
        label="Provided Value"
        className="slds-m-right_x-small slds-grow"
        items={picklistItems}
        selectedItemIds={selectedField.type === 'multipicklist' ? value.split(';') : [value]}
        multiSelection={selectedField.type === 'multipicklist'}
        omitMultiSelectPills
        isRequired
        disabled={disabled}
        onChange={(values) => {
          if (selectedField.type === 'multipicklist') {
            onChange(values.map((item) => item.id).join(';'));
          } else {
            onChange(values[0]?.id);
          }
        }}
      ></Picklist>
    );
  }

  return (
    <div
      className="slds-m-right_x-small slds-grow"
      css={css`
        min-width: 240px;
      `}
    >
      <Input label="Provided Value" isRequired>
        <ControlledInput
          className="slds-input"
          placeholder="Value to set on each record"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.target.value)}
        />
      </Input>
    </div>
  );
};
