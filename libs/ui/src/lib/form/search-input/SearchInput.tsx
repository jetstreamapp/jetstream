/** @jsx jsx */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { jsx } from '@emotion/core';
import { FunctionComponent, useState, useEffect, useRef } from 'react';
import Input from '../input/Input';
import { useDebounce } from '@jetstream/shared/ui-utils';

export interface SearchInputProps {
  id: string;
  placeholder?: string;
  autoFocus?: boolean;
  onChange: (value: string) => void;
}

export const SearchInput: FunctionComponent<SearchInputProps> = ({ id, placeholder, autoFocus, onChange, children }) => {
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
        onChange={(event) => setValue(event.currentTarget.value)}
      />
      {children}
    </Input>
  );
};

export default SearchInput;
