/* eslint-disable @typescript-eslint/no-explicit-any */

import { isArrowDownKey, isArrowUpKey, useDebounce, useNonInitialEffect } from '@jetstream/shared/ui-utils';
import { UpDown } from '@jetstream/types';
import { FunctionComponent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import Input from '../input/Input';

export interface SearchInputProps {
  id: string;
  className?: string;
  placeholder?: string;
  autoFocus?: boolean;
  /**
   * Optional value to control the input externally
   * Normally this can be omitted and the component will manage its own state
   */
  value?: string;
  disabled?: boolean;
  onChange: (value: string) => void;
  onArrowKeyUpDown?: (direction: UpDown) => void;
  children?: React.ReactNode;
}

export const SearchInput: FunctionComponent<SearchInputProps> = ({
  id,
  className,
  placeholder,
  autoFocus,
  value: incomingValue = '',
  disabled,
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
    <Input className={className} iconLeft="search" iconLeftType="utility" clearButton={!!value} onClear={() => setValue('')}>
      <input
        ref={inputEl}
        className="slds-input"
        type="search"
        id={id}
        placeholder={placeholder}
        value={value}
        autoFocus={autoFocus}
        autoComplete="off"
        disabled={disabled}
        onChange={(event) => setValue(event.currentTarget.value)}
        onKeyUp={handleKeyUp}
      />
      {children}
    </Input>
  );
};

export default SearchInput;
