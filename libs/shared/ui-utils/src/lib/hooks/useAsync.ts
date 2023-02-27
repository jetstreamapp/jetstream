import { useEffect, useState, useCallback, useRef } from 'react';

// CREDIT: https://dev.to/dglsparsons/3-amazing-react-hooks-to-keep-your-code-organized-neatly-ghe

/**
 * USAGE PATTERN:
 * // execute async action immediately
 * const { execute, loading, result, error } = useAsync(someAsyncFn);
 *
 * // return execute method that can be called at some other point in time
 * // if asyncFunction or immediate values are modified, then execute will be modified
 * / calling execute will cause a re-render because loading will change to true
 * // then another re-render once the results or an error are returned
 * const { execute, loading, result, error } = useAsync(someAsyncFn);
 *
 * @param asyncFunction
 * @param immediate
 */
// eslint-disable-next-line @typescript-eslint/ban-types
export const useAsync = (asyncFunction: Function, immediate = true) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  // track if component is mounted
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  /**
   * Call async function and set all state based on outcome
   */
  const execute = useCallback(
    async (...args) => {
      setLoading(true);
      if (result !== null) {
        setResult(null);
      }
      if (error !== null) {
        setError(null);
      }
      try {
        const currResult = await asyncFunction(...args);
        if (isMounted.current) {
          setResult(currResult);
        }
        return currResult;
      } catch (ex) {
        if (isMounted.current) {
          setError(ex);
        }
      } finally {
        if (isMounted.current) {
          setLoading(false);
        }
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [asyncFunction]
  );

  useEffect(() => {
    if (immediate) {
      execute();
    }
  }, [execute, immediate]);

  return { execute, loading, result, error };
};

export default useAsync;
