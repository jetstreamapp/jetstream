import { Maybe } from '@jetstream/types';
import { ChangeEvent, useEffect, useState } from 'react';

function parseIntegerInput(value: string): number | null {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) ? parsed : null;
}

/**
 * Backs a numeric text input with the raw string the user typed rather than the parsed number.
 *
 * Rendering `value={someNumber || ''}` looks harmless but makes the field erase itself mid-edit:
 * deleting the leading digit of `10000` leaves `"0000"`, which parses to `0`, which is falsy, which
 * renders as an empty input. Keeping the string means partial input survives until the user is done.
 *
 * @param value The committed numeric value. Changes made outside the input (a recalculated default,
 *   for example) are adopted without disturbing in-progress typing.
 * @param onChange Receives the parsed value, or null when the field does not hold a number.
 */
export function useIntegerInput(value: Maybe<number>, onChange: (value: number | null) => void) {
  const [inputValue, setInputValue] = useState(() => (value == null ? '' : String(value)));

  useEffect(() => {
    setInputValue((current) => {
      if (parseIntegerInput(current) === (value ?? null)) {
        return current;
      }
      return value == null ? '' : String(value);
    });
  }, [value]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    setInputValue(event.target.value);
    onChange(parseIntegerInput(event.target.value));
  }

  /** Collapse whatever was typed to its canonical form once editing finishes (`"0000"` → `"0"`). */
  function handleBlur() {
    const parsed = parseIntegerInput(inputValue);
    setInputValue(parsed == null ? '' : String(parsed));
  }

  return { inputValue, handleChange, handleBlur };
}
