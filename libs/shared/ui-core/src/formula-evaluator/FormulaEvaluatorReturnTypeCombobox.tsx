import { SFDC_BLANK_PICKLIST_VALUE } from '@jetstream/shared/constants';
import { ListItem } from '@jetstream/types';
import { ComboboxSharedProps, ComboboxWithItems } from '@jetstream/ui';
import { FunctionComponent } from 'react';
import { FormulaReturnTypeWithEmptyState } from '../state-management/formula-evaluator.state';

const RETURN_TYPE_ITEMS: ListItem[] = [
  { id: 'string', label: 'Text', value: 'string' },
  { id: 'number', label: 'Number', value: 'number' },
  { id: 'boolean', label: 'Checkbox', value: 'boolean' },
  { id: 'date', label: 'Date', value: 'date' },
  { id: 'datetime', label: 'Date/Time', value: 'datetime' },
  { id: 'time', label: 'Time', value: 'time' },
  { id: SFDC_BLANK_PICKLIST_VALUE, label: '--Skip Type Validation--', value: SFDC_BLANK_PICKLIST_VALUE },
];

export interface FormulaEvaluatorReturnTypeComboboxProps {
  comboboxProps?: Partial<ComboboxSharedProps>;
  returnType: FormulaReturnTypeWithEmptyState;
  onChange: (returnType: FormulaReturnTypeWithEmptyState) => void;
}

export const FormulaEvaluatorReturnTypeCombobox: FunctionComponent<FormulaEvaluatorReturnTypeComboboxProps> = ({
  comboboxProps,
  returnType,
  onChange,
}) => {
  return (
    <ComboboxWithItems
      comboboxProps={{
        label: 'Output Type',
        helpText: 'The expected return type of the formula. Validates the result matches this type.',
        placeholder: 'Select output type...',
        onClear: () => onChange(null),
        ...comboboxProps,
      }}
      items={RETURN_TYPE_ITEMS}
      selectedItemId={returnType}
      onSelected={(item) => onChange(item.value as FormulaReturnTypeWithEmptyState)}
    />
  );
};
