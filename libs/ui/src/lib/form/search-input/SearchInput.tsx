/** @jsx jsx */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { jsx } from '@emotion/core';
import { FunctionComponent, useState, useEffect } from 'react';
import Input from '../input/Input';
import { useDebounce } from '@jetstream/shared/ui-utils';

export interface SearchInputProps {
  id: string;
  placeholder?: string;
  onChange: (value: string) => void;
}

export const SearchInput: FunctionComponent<SearchInputProps> = ({ id, placeholder, onChange, children }) => {
  const [value, setValue] = useState<string>('');
  const debouncedFilters = useDebounce(value);

  useEffect(() => {
    onChange(debouncedFilters || '');
  }, [onChange, debouncedFilters]);

  return (
    <Input iconLeft="search" iconLeftType="utility" clearButton={!!value} onClear={() => setValue('')}>
      <input
        className="slds-input"
        type="search"
        id={id}
        placeholder={placeholder}
        value={value}
        onChange={(event) => setValue(event.currentTarget.value)}
      />
      {children}
    </Input>
  );
};

export default SearchInput;
