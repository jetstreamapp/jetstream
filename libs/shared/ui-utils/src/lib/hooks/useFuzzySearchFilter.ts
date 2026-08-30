import Fuse, { IFuseOptions } from 'fuse.js';
import { useEffect, useMemo, useState } from 'react';
import { useDebounce } from './useDebounce';

const DEFAULT_OPTIONS: IFuseOptions<unknown> = {
  includeScore: true,
  findAllMatches: true,
  ignoreLocation: true,
  includeMatches: true,
  keys: ['label', 'value', 'secondaryLabel', 'tertiaryLabel'],
};

export function useFuzzySearchFilter<T extends object>(items: T[], filter: string, options: IFuseOptions<unknown> = DEFAULT_OPTIONS) {
  const fuse = useMemo(() => new Fuse<T>(items, { ...options }), [items, options]);

  const debouncedFilter = useDebounce(filter, 300);
  // Clearing must apply immediately: a debounced reset made lists visibly "pop in" 300ms after
  // the input was cleared or a previously-filtered dropdown was reopened
  const filterText = filter ? debouncedFilter : '';
  const [visibleItems, setVisibleItems] = useState(items);

  useEffect(() => {
    if (filterText) {
      const result = fuse.search(filterText);
      setVisibleItems(result.map(({ item }) => item));
    } else {
      setVisibleItems(items);
    }
  }, [filterText, fuse, items]);

  return visibleItems;
}
