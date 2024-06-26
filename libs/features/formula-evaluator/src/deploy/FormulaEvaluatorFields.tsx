import { ListItem } from '@jetstream/types';
import { Grid, GridCol, Input, Picklist, Radio, RadioGroup, Textarea } from '@jetstream/ui';
import {
  FieldDefinitionMetadata,
  FieldValue,
  FieldValueState,
  FieldValues,
  SalesforceFieldType,
  calculateFieldValidity,
  generateApiNameFromLabel,
} from '@jetstream/ui-core';
import clamp from 'lodash/clamp';

const NUMBER_TYPES = new Set<SalesforceFieldType>(['Number', 'Currency', 'Percent']);

const fieldType: ListItem[] = [
  { id: 'Checkbox', label: 'Checkbox', value: 'Checkbox' },
  { id: 'Currency', label: 'Currency', value: 'Currency' },
  { id: 'Date', label: 'Date', value: 'Date' },
  { id: 'Datetime', label: 'Datetime', value: 'Datetime' },
  { id: 'Number', label: 'Number', value: 'Number' },
  { id: 'Percent', label: 'Percent', value: 'Percent' },
  { id: 'Text', label: 'Text', value: 'Text' },
  { id: 'Time', label: 'Time', value: 'Time' },
];

export interface FormulaEvaluatorFieldsProps {
  formula: string;
  field: FieldValues;
  loading: boolean;
  onFieldChange: (field: FieldValues, isValid: boolean) => void;
}

export function FormulaEvaluatorFields({ formula, field, loading, onFieldChange }: FormulaEvaluatorFieldsProps) {
  function setValue(key: keyof FieldDefinitionMetadata, value: FieldValue) {
    const tempValue: FieldValueState = {
      ...field[key],
      touched: true,
      value,
    };
    const tempField = { ...field, [key]: tempValue };
    if (key === 'label') {
      tempField.fullName = {
        ...tempField.fullName,
        value: generateApiNameFromLabel(value as string),
      };
    }
    const updatedRows = calculateFieldValidity([tempField]);
    onFieldChange(updatedRows.rows[0], updatedRows.allValid);
  }

  return (
    <Grid gutters wrap>
      <GridCol size={12} sizeMedium={6}>
        <Input
          label="Field Label"
          isRequired
          errorMessage={field.label.errorMessage}
          hasError={!field.label.isValid && !!field.label.errorMessage}
        >
          <input
            className="slds-input"
            required
            minLength={1}
            maxLength={40}
            value={(field.label.value as string) || ''}
            autoComplete="off"
            autoFocus
            onChange={(event) => setValue('label', event.target.value)}
          />
        </Input>
      </GridCol>

      <GridCol size={12} sizeMedium={6}>
        <Input
          label="Field Name"
          isRequired
          errorMessage={field.fullName.errorMessage}
          hasError={!field.fullName.isValid && !!field.fullName.errorMessage}
        >
          <input
            className="slds-input"
            required
            minLength={3}
            maxLength={43}
            value={(field.fullName.value as string) || ''}
            autoComplete="off"
            onChange={(event) => setValue('fullName', event.target.value)}
          />
        </Input>
      </GridCol>

      <GridCol size={12} sizeMedium={6}>
        <Picklist
          className="slds-m-top_x-small"
          isRequired
          label="Field Type"
          items={fieldType}
          selectedItemIds={[field.secondaryType.value as string]}
          disabled={loading}
          onChange={(values) => (values.length > 0 ? setValue('secondaryType', values[0].value) : setValue('secondaryType', 'text'))}
          errorMessage={field.secondaryType.errorMessage}
          hasError={!field.secondaryType.isValid && !!field.secondaryType.errorMessage}
        ></Picklist>
      </GridCol>

      <GridCol size={12} sizeMedium={6}>
        <RadioGroup
          label="How to handle null values for numbers"
          formControlClassName="slds-grid"
          errorMessage={field.formulaTreatBlanksAs.errorMessage}
          hasError={!field.formulaTreatBlanksAs.isValid && !!field.formulaTreatBlanksAs.errorMessage}
        >
          <Grid vertical>
            <Radio
              id="null-zero-modal"
              name="handle-nulls"
              label="Treat as zero"
              value="BlankAsZero"
              checked={field.formulaTreatBlanksAs.value === 'BlankAsZero'}
              onChange={(value) => setValue('formulaTreatBlanksAs', value)}
              disabled={loading}
            />
            <Radio
              id="null-blank-modal"
              name="handle-nulls"
              label="Treat as blank"
              value="Blanks"
              checked={field.formulaTreatBlanksAs.value === 'Blanks'}
              onChange={(value) => setValue('formulaTreatBlanksAs', value)}
              disabled={loading}
            />
          </Grid>
        </RadioGroup>
      </GridCol>

      {NUMBER_TYPES.has(field.secondaryType.value as SalesforceFieldType) && (
        <>
          <GridCol size={12} sizeMedium={6}>
            <Input
              label="Length"
              errorMessage={field.precision.errorMessage}
              hasError={!field.precision.isValid && !!field.precision.errorMessage}
            >
              <input
                className="slds-input"
                value={(field.precision.value as string) ?? ''}
                autoComplete="off"
                onChange={(event) => setValue('precision', event.target.value)}
              />
            </Input>
          </GridCol>

          <GridCol size={12} sizeMedium={6}>
            <Input
              label="Decimal Places"
              errorMessage={field.scale.errorMessage}
              hasError={!field.scale.isValid && !!field.scale.errorMessage}
            >
              <input
                className="slds-input"
                value={(field.scale.value as string) ?? ''}
                autoComplete="off"
                onChange={(event) => setValue('scale', event.target.value)}
              />
            </Input>
          </GridCol>
        </>
      )}

      <GridCol size={12}>
        <Textarea
          id="description"
          label="Field Description"
          errorMessage={field.description.errorMessage}
          hasError={!field.description.isValid && !!field.description.errorMessage}
        >
          <textarea
            className="slds-textarea"
            maxLength={254}
            value={(field.description.value as string) || ''}
            autoComplete="off"
            onChange={(event) => setValue('description', event.target.value)}
            disabled={loading}
          />
        </Textarea>
      </GridCol>
      <GridCol size={12}>
        <Textarea
          id="help-text"
          label="Field Help Text"
          errorMessage={field.inlineHelpText.errorMessage}
          hasError={!field.inlineHelpText.isValid && !!field.inlineHelpText.errorMessage}
        >
          <textarea
            className="slds-textarea"
            maxLength={254}
            value={(field.inlineHelpText.value as string) || ''}
            autoComplete="off"
            onChange={(event) => setValue('inlineHelpText', event.target.value)}
            disabled={loading}
          />
        </Textarea>
      </GridCol>
      <GridCol size={12}>
        <Textarea id="formula" label="Formula">
          <textarea className="slds-textarea" value={formula} disabled rows={clamp(formula.split('\n').length + 1, 3, 10)} />
        </Textarea>
      </GridCol>
    </Grid>
  );
}

export default FormulaEvaluatorFields;
