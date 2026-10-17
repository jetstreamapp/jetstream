import { useCallback, useState } from 'react';
import { getErrorMessage } from '../api/admin-api-client';

/**
 * Tracks loading and error state for a user-triggered request (a button click or form submit).
 * `run` resolves to undefined when the action failed; the error is exposed for rendering.
 */
export function useAsyncAction<Args extends unknown[], Result>(action: (...args: Args) => Promise<Result>) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const run = useCallback(
    async (...args: Args): Promise<Result | undefined> => {
      setLoading(true);
      setError(null);
      try {
        return await action(...args);
      } catch (ex) {
        setError(ex instanceof Error ? ex : new Error(getErrorMessage(ex)));
        return undefined;
      } finally {
        setLoading(false);
      }
    },
    [action],
  );

  const clearError = useCallback(() => setError(null), []);

  return { run, loading, error, clearError };
}
