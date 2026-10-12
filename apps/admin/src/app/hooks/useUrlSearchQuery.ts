import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useDebouncedValue } from './useDebouncedValue';

/**
 * Search input state that is debounced into a URL query parameter, so a search survives reloads and
 * can be shared. Returns the live input value and the committed (URL) query to fetch with.
 */
export function useUrlSearchQuery(paramName = 'query') {
  const [searchParams, setSearchParams] = useSearchParams();
  const urlQuery = searchParams.get(paramName) ?? '';
  const [inputValue, setInputValue] = useState(urlQuery);
  const debouncedInputValue = useDebouncedValue(inputValue.trim(), 300);
  const lastCommittedQueryRef = useRef(urlQuery);

  useEffect(() => {
    if (debouncedInputValue === lastCommittedQueryRef.current) {
      return;
    }
    lastCommittedQueryRef.current = debouncedInputValue;
    setSearchParams(
      (previousParams) => {
        const nextParams = new URLSearchParams(previousParams);
        if (debouncedInputValue) {
          nextParams.set(paramName, debouncedInputValue);
        } else {
          nextParams.delete(paramName);
        }
        return nextParams;
      },
      { replace: true },
    );
  }, [debouncedInputValue, paramName, setSearchParams]);

  // Back/forward navigation changes the URL without touching the input, so pull the value back in
  useEffect(() => {
    if (urlQuery !== lastCommittedQueryRef.current) {
      lastCommittedQueryRef.current = urlQuery;
      setInputValue(urlQuery);
    }
  }, [urlQuery]);

  return { inputValue, setInputValue, query: urlQuery };
}

export function buildSearchPath(basePath: string, query: string, limit = 100): string {
  const params = new URLSearchParams({ limit: String(limit) });
  if (query) {
    params.set('query', query);
  }
  return `${basePath}?${params.toString()}`;
}
