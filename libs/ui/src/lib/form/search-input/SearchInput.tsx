import { isArrowDownKey, isArrowUpKey, useDebounce, useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { UpDown } from '@jetstream/types';
import { FunctionComponent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import Input from '../input/Input';

export interface SearchInputProps {
  id: string;
  className?: string;
  /**
   * Accessible name for the input. Falls back to the placeholder, which is what most screen readers
   * announce, but a placeholder is not a label (3.3.2) — pass this where the field's purpose is not
   * obvious from context (e.g. a per-column filter: "Filter Account Name").
   */
  ariaLabel?: string;
  placeholder?: string;
  autoFocus?: boolean;
  /**
   * Optional value to control the input externally
   * Normally this can be omitted and the component will manage its own state
   */
  value?: string;
  disabled?: boolean;
  loading?: boolean;
  onChange: (value: string) => void;
  onArrowKeyUpDown?: (direction: UpDown) => void;
  children?: React.ReactNode;
}

export const SearchInput: FunctionComponent<SearchInputProps> = ({
  id,
  ariaLabel,
  className,
  placeholder,
  autoFocus,
  value: incomingValue = '',
  disabled,
  loading,
  onChange,
  onArrowKeyUpDown,
  children,
}) => {
  const [value, setValue] = useState<string>(incomingValue || '');
  const debouncedFilters = useDebounce(value);
  const inputEl = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (incomingValue !== value) {
      setValue(incomingValue);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incomingValue]);

  useEffect(() => {
    autoFocus && inputEl.current?.focus();
  }, [autoFocus]);

  useNonInitialEffect(() => {
    onChange(debouncedFilters || '');
  }, [onChange, debouncedFilters]);

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    // Stop propagation for keys that should be handled natively by the text input.
    // This prevents parent components (e.g. data grids) from intercepting cursor navigation shortcuts
    // like Cmd/Ctrl+Left/Right (jump to start/end of word/line), Home, End, and Ctrl/Cmd+A (select all).
    const { key, ctrlKey, metaKey } = event;
    if (
      key === 'ArrowLeft' ||
      key === 'ArrowRight' ||
      key === 'Home' ||
      key === 'End' ||
      ((ctrlKey || metaKey) && (key === 'a' || key === 'A'))
    ) {
      event.stopPropagation();
    }
    // The Up/Down action itself fires on keyup (below), but the keydown must be consumed here too:
    // when this input sits inside a List (nested field lists), the bubbled keydown would move the
    // parent list's focus before the keyup ever ran.
    if (onArrowKeyUpDown && (isArrowUpKey(event) || isArrowDownKey(event))) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  function handleKeyUp(event: KeyboardEvent<HTMLInputElement>) {
    if (onArrowKeyUpDown) {
      let direction: UpDown | undefined = undefined;
      if (isArrowUpKey(event)) {
        direction = 'UP';
      } else if (isArrowDownKey(event)) {
        direction = 'DOWN';
      }
      if (direction) {
        event.preventDefault();
        event.stopPropagation();
        onArrowKeyUpDown(direction);
      }
    }
  }

  return (
    <Input
      id={id}
      className={className}
      iconLeft="search"
      iconLeftType="utility"
      loading={loading}
      clearButton={!!value}
      onClear={() => {
        setValue('');
        // The X removes itself when the value empties — put focus back in the input
        inputEl.current?.focus();
      }}
    >
      <input
        ref={inputEl}
        className="slds-input"
        type="search"
        id={id}
        aria-label={ariaLabel ?? placeholder}
        placeholder={placeholder}
        value={value}
        autoFocus={autoFocus}
        autoComplete="off"
        // Password managers inject autofill UI into inputs, which screen readers then announce
        // ("1Password menu available") — these are the vendors' documented opt-outs, appropriate
        // for search/filter fields that never hold credentials
        data-1p-ignore
        data-lpignore="true"
        data-bwignore="true"
        disabled={disabled}
        onChange={(event) => setValue(event.currentTarget.value)}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
      />
      {children}
    </Input>
  );
};

export default SearchInput;
