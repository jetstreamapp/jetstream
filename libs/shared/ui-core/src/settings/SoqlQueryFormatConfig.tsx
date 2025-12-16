import { css } from '@emotion/react';
import { ANALYTICS_KEYS } from '@jetstream/shared/constants';
import { SoqlQueryFormatOptions } from '@jetstream/types';
import { Checkbox, Input } from '@jetstream/ui';
import { useEffect, useState } from 'react';
import { useAmplitude } from '../analytics';

interface SoqlQueryFormatConfigProps {
  className?: string;
  location: string;
  omitHeader?: boolean;
  value: SoqlQueryFormatOptions;
  onChange: (value: SoqlQueryFormatOptions) => void;
  onCancel?: () => void;
}

export const SoqlQueryFormatConfig = ({
  className,
  omitHeader = false,
  value,
  location,
  onChange,
  onCancel,
}: SoqlQueryFormatConfigProps) => {
  const { trackEvent } = useAmplitude();
  const [currentValue, setCurrentValue] = useState(value);
  // Local state for input fields to allow clearing
  const [fieldMaxLineLengthInput, setFieldMaxLineLengthInput] = useState(String(value.fieldMaxLineLength ?? 1));
  const [numIndentInput, setNumIndentInput] = useState(String(value.numIndent ?? 1));

  useEffect(() => {
    setCurrentValue(value);
    setFieldMaxLineLengthInput(String(value.fieldMaxLineLength ?? 1));
    setNumIndentInput(String(value.numIndent ?? 1));
  }, [value]);

  const isDirty = JSON.stringify(currentValue) !== JSON.stringify(value);

  // Check if inputs are valid numbers >= 1
  const isFieldMaxLineLengthValid = !isNaN(Number(fieldMaxLineLengthInput)) && Number(fieldMaxLineLengthInput) >= 1;
  const isNumIndentValid = !isNaN(Number(numIndentInput)) && Number(numIndentInput) >= 1;
  const hasInvalidInputs = !isFieldMaxLineLengthValid || !isNumIndentValid;

  function handleReset() {
    setCurrentValue(value);
    setFieldMaxLineLengthInput(String(value.fieldMaxLineLength ?? 1));
    setNumIndentInput(String(value.numIndent ?? 1));
    onCancel?.();
    trackEvent(ANALYTICS_KEYS.soql_format_reset, { location, values: currentValue });
  }

  function handleSave() {
    onChange(currentValue);
    trackEvent(ANALYTICS_KEYS.soql_format_saved, { location, values: currentValue });
  }

  return (
    <div className={className}>
      {!omitHeader && <h2 className="slds-text-heading_medium slds-m-top_x-small">SOQL Format Options</h2>}
      <div
        css={css`
          max-width: 300px;
        `}
      >
        <Input
          label="Max Characters per line"
          labelHelp="Set the maximum number of characters per line for formatted SOQL queries. Set to 1 to have each field on its own line."
          hasError={!isFieldMaxLineLengthValid}
          errorMessage={!isFieldMaxLineLengthValid ? 'Must be a number greater than or equal to 1' : undefined}
        >
          <input
            className="slds-input"
            pattern="[0-9]"
            type="number"
            min={1}
            value={fieldMaxLineLengthInput}
            onChange={(ev) => {
              const inputValue = ev.target.value;
              setFieldMaxLineLengthInput(inputValue);

              const numValue = Number(inputValue);
              if (!isNaN(numValue) && numValue >= 1) {
                setCurrentValue((prev) => ({ ...prev, fieldMaxLineLength: numValue }));
              }
            }}
          />
        </Input>
        <Input
          label="Indent Size"
          labelHelp="Set the number of spaces to use for each indentation level in formatted SOQL queries."
          hasError={!isNumIndentValid}
          errorMessage={!isNumIndentValid ? 'Must be a number greater than or equal to 1' : undefined}
        >
          <input
            className="slds-input"
            pattern="[0-9]"
            type="number"
            min={1}
            value={numIndentInput}
            onChange={(ev) => {
              const inputValue = ev.target.value;
              setNumIndentInput(inputValue);

              const numValue = Number(inputValue);
              if (!isNaN(numValue) && numValue >= 1) {
                setCurrentValue((prev) => ({ ...prev, numIndent: numValue }));
              }
            }}
          />
        </Input>

        <Checkbox
          id="newLineAfterKeywords"
          checked={currentValue.newLineAfterKeywords ?? false}
          label="New Line After Keywords"
          labelHelp="Place a new line after keywords (SELECT, FROM, WHERE, etc.)."
          onChange={(checked) => {
            setCurrentValue((prev) => ({ ...prev, newLineAfterKeywords: checked }));
          }}
        />

        <Checkbox
          id="whereClauseOperatorsIndented"
          checked={currentValue.whereClauseOperatorsIndented ?? false}
          label="Indent WHERE Clause Operators"
          labelHelp="Indent the operators in the WHERE clause for better readability."
          onChange={(checked) => {
            setCurrentValue((prev) => ({ ...prev, whereClauseOperatorsIndented: checked }));
          }}
        />

        <Checkbox
          id="fieldSubqueryParensOnOwnLine"
          checked={currentValue.fieldSubqueryParensOnOwnLine ?? false}
          label="Subquery Parentheses on Own Line"
          labelHelp="Place the opening and closing parentheses of subqueries on their own lines."
          onChange={(checked) => {
            setCurrentValue((prev) => ({ ...prev, fieldSubqueryParensOnOwnLine: checked }));
          }}
        />

        <div className="slds-m-top_medium">
          <button className="slds-button slds-button_neutral slds-m-right_xx-small" disabled={!isDirty} onClick={handleReset}>
            Cancel
          </button>
          <button className="slds-button slds-button_brand" onClick={handleSave} disabled={!isDirty || hasInvalidInputs}>
            Save
          </button>
        </div>
      </div>
    </div>
  );
};
