import { logger } from '@jetstream/shared/client-logger';
import { getCsrfToken } from '@jetstream/shared/data';
import { useCallback, useEffect, useState } from 'react';

export function useCsrfToken() {
  const [csrfToken, setCsrfToken] = useState<string>();
  const [loading, setLoading] = useState(false);

  const fetchCsrfToken = useCallback(async () => {
    try {
      setLoading(true);
      setCsrfToken((await getCsrfToken()).csrfToken);
    } catch (ex) {
      logger.warn('[FETCH CSRF][ERROR]', ex);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCsrfToken();
  }, [fetchCsrfToken]);

  return { loading, csrfToken };
}
