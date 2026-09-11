import { css } from '@emotion/react';
import { ReactNode, useState } from 'react';
import Icon from '../../widgets/Icon';
import { Input } from './Input';

export interface NumberStepperInputProps {
  id: string;
  testId?: string;
  label: string;
  value: number;
  min: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  isRequired?: boolean;
  helpText?: ReactNode;
  hasError?: boolean;
  errorMessage?: ReactNode;
  decrementLabel?: string;
  incrementLabel?: string;
  onChange: (value: number) => void;
}

function parseInteger(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function clamp(value: number, min: number, max: number | undefined): number {
  const upperBounded = max === undefined ? value : Math.min(value, max);
  return Math.max(upperBounded, min);
}

/**
 * Integer input with minus/plus buttons. The text box keeps the raw string while the user types so
 * partial input survives; only parseable integers are emitted, and the value is clamped into range
 * once the field loses focus. Buttons are `type="button"` so the stepper is safe inside a form.
 */
export function NumberStepperInput({
  id,
  testId,
  label,
  value,
  min,
  max,
  step = 1,
  disabled = false,
  isRequired = false,
  helpText,
  hasError = false,
  errorMessage,
  decrementLabel = 'Decrease',
  incrementLabel = 'Increase',
  onChange,
}: NumberStepperInputProps) {
  const [inputValue, setInputValue] = useState(String(value));
  const [syncedValue, setSyncedValue] = useState(value);

  // Adopt a value changed by the parent (a recalculated minimum, for example) without disturbing
  // in-progress typing that already parses to the same number
  if (value !== syncedValue) {
    setSyncedValue(value);
    if (parseInteger(inputValue) !== value) {
      setInputValue(String(value));
    }
  }

  const errorMessageId = `${id}-error`;
  const canDecrement = !disabled && value - step >= min;
  const canIncrement = !disabled && (max === undefined || value + step <= max);

  function commit(nextValue: number) {
    const clamped = clamp(nextValue, min, max);
    setInputValue(String(clamped));
    onChange(clamped);
  }

  function handleInputChange(nextInputValue: string) {
    setInputValue(nextInputValue);
    const parsed = parseInteger(nextInputValue);
    if (parsed !== null) {
      onChange(parsed);
    }
  }

  function handleBlur() {
    const parsed = parseInteger(inputValue);
    // Nothing usable was typed, so fall back to the last committed value
    commit(parsed === null ? value : parsed);
  }

  return (
    <Input
      id={id}
      label={label}
      isRequired={isRequired}
      helpText={helpText}
      hasError={hasError}
      errorMessage={errorMessage}
      errorMessageId={errorMessageId}
    >
      <div
        className="slds-grid slds-grid_vertical-align-center"
        css={css`
          gap: 0.25rem;
        `}
      >
        <button
          type="button"
          className="slds-button slds-button_icon slds-button_icon-border-filled"
          title={decrementLabel}
          disabled={!canDecrement}
          onClick={() => commit(value - step)}
        >
          <Icon type="utility" icon="dash" className="slds-button__icon" omitContainer />
          <span className="slds-assistive-text">{decrementLabel}</span>
        </button>
        <input
          id={id}
          data-testid={testId}
          type="number"
          inputMode="numeric"
          className="slds-input slds-text-align_center"
          css={css`
            max-width: 6rem;
            -moz-appearance: textfield;
            &::-webkit-outer-spin-button,
            &::-webkit-inner-spin-button {
              -webkit-appearance: none;
              margin: 0;
            }
          `}
          value={inputValue}
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          required={isRequired}
          aria-invalid={hasError}
          aria-describedby={hasError && errorMessage ? errorMessageId : undefined}
          onChange={(event) => handleInputChange(event.target.value)}
          onBlur={handleBlur}
        />
        <button
          type="button"
          className="slds-button slds-button_icon slds-button_icon-border-filled"
          title={incrementLabel}
          disabled={!canIncrement}
          onClick={() => commit(value + step)}
        >
          <Icon type="utility" icon="add" className="slds-button__icon" omitContainer />
          <span className="slds-assistive-text">{incrementLabel}</span>
        </button>
      </div>
    </Input>
  );
}

export default NumberStepperInput;
