import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useDebouncedValue } from './useDebouncedValue';

const PAGE_PARAM = 'page';

function parsePage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

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
        // New results start over at the first page
        nextParams.delete(PAGE_PARAM);
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

/**
 * Filter, sort and page state kept in the URL next to the search query. Changing a filter or sort starts
 * over at page 1; paging pushes a history entry so the back button returns to the previous page.
 */
export function useUrlListState() {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = parsePage(searchParams.get(PAGE_PARAM));

  const setParams = useCallback(
    (updates: Record<string, string | null>) => {
      setSearchParams(
        (previousParams) => {
          const nextParams = new URLSearchParams(previousParams);
          Object.entries(updates).forEach(([key, value]) => {
            if (value) {
              nextParams.set(key, value);
            } else {
              nextParams.delete(key);
            }
          });
          nextParams.delete(PAGE_PARAM);
          return nextParams;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const setPage = useCallback(
    (nextPage: number) => {
      setSearchParams((previousParams) => {
        const nextParams = new URLSearchParams(previousParams);
        if (nextPage > 1) {
          nextParams.set(PAGE_PARAM, String(nextPage));
        } else {
          nextParams.delete(PAGE_PARAM);
        }
        return nextParams;
      });
    },
    [setSearchParams],
  );

  return { searchParams, page, setParams, setPage };
}

/** Builds an API path, leaving out empty parameters */
export function buildListPath(basePath: string, params: Record<string, string | number | null | undefined>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined && value !== '') {
      searchParams.set(key, String(value));
    }
  });
  const search = searchParams.toString();
  return search ? `${basePath}?${search}` : basePath;
}
