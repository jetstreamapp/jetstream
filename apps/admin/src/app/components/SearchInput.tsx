import { MagnifyingGlassIcon } from '@heroicons/react/20/solid';

export interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  label?: string;
}

export function SearchInput({ value, onChange, placeholder = 'Search', autoFocus, label = 'Search' }: SearchInputProps) {
  return (
    <div className="relative max-w-xl flex-1">
      <MagnifyingGlassIcon
        className="pointer-events-none absolute top-1/2 left-2.5 h-4 w-4 -translate-y-1/2 text-slate-400"
        aria-hidden="true"
      />
      <input
        type="search"
        aria-label={label}
        value={value}
        autoFocus={autoFocus}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="block w-full rounded-md border-0 py-1.5 pr-3 pl-8 text-sm text-slate-900 shadow-sm ring-1 ring-slate-300 ring-inset placeholder:text-slate-400 focus:ring-2 focus:ring-blue-600 focus:ring-inset"
      />
    </div>
  );
}
