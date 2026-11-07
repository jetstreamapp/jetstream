import { getSessionCsrfToken } from '@jetstream/shared/data';
import { useEffect, useState } from 'react';

/**
 * The session CSRF token for forms the browser submits itself (e.g. `target="_blank"` downloads), which do not go
 * through `handleRequest` and so have to carry the token in a hidden `csrfToken` field.
 */
export function useSessionCsrfToken() {
  const [csrfToken, setCsrfToken] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    getSessionCsrfToken().then((token) => {
      if (isMounted) {
        setCsrfToken(token);
      }
    });
    return () => {
      isMounted = false;
    };
  }, []);

  return csrfToken;
}
