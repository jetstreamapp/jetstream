/** @jsx jsx */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { jsx } from '@emotion/core';
import { isArrowDownKey, isArrowUpKey, useDebounce } from '@jetstream/shared/ui-utils';
import { UpDown } from '@jetstream/types';
import { FunctionComponent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import Input from '../input/Input';

export interface SearchInputProps {
  id: string;
  placeholder?: string;
  autoFocus?: boolean;
  onChange: (value: string) => void;
  onArrowKeyUpDown?: (direction: UpDown) => void;
}

export const SearchInput: FunctionComponent<SearchInputProps> = ({ id, placeholder, autoFocus, onChange, onArrowKeyUpDown, children }) => {
  const [value, setValue] = useState<string>('');
  const debouncedFilters = useDebounce(value);
  const inputEl = useRef<HTMLInputElement>();

  useEffect(() => {
    if (autoFocus && inputEl.current) {
      inputEl.current.focus();
    }
  }, [inputEl]);

  useEffect(() => {
    onChange(debouncedFilters || '');
  }, [onChange, debouncedFilters]);

  function handleKeyUp(event: KeyboardEvent<HTMLInputElement>) {
    if (onArrowKeyUpDown) {
      let direction: UpDown;
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
    <Input iconLeft="search" iconLeftType="utility" clearButton={!!value} onClear={() => setValue('')}>
      <input
        ref={inputEl}
        className="slds-input"
        type="search"
        id={id}
        placeholder={placeholder}
        value={value}
        autoFocus={autoFocus}
        autoComplete="off"
        onChange={(event) => setValue(event.currentTarget.value)}
        onKeyUp={handleKeyUp}
      />
      {children}
    </Input>
  );
};

export default SearchInput;
