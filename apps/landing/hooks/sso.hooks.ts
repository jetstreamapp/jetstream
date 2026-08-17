import { Maybe } from '@jetstream/types';
import { useCallback, useRef, useState } from 'react';
import { z } from 'zod';
import { ROUTES } from '../utils/environment';

const SsoDiscoveryResponseSchema = z.object({
  data: z.object({ available: z.boolean() }),
});

const SsoStartResponseSchema = z.object({
  data: z.object({ redirectUrl: z.string().min(1) }),
});

const SsoErrorResponseSchema = z.object({
  errorType: z.string().optional(),
  data: z.object({ errorType: z.string().optional() }).optional(),
});

/** Error types the API returns when the email domain has no usable SSO configuration */
const SSO_UNAVAILABLE_ERROR_TYPES = new Set(['InvalidProvider', 'ProviderNotAllowed']);

const SSO_UNAVAILABLE_MESSAGE =
  'Single sign-on is not available for this email address. Contact your administrator or sign in with another method.';
const SSO_RATE_LIMITED_MESSAGE = 'Too many attempts. Wait a few minutes and try again.';
const SSO_UNKNOWN_ERROR_MESSAGE = 'Something went wrong starting single sign-on. Try again or sign in with another method.';

const JSON_HEADERS = { 'Content-Type': 'application/json', Accept: 'application/json' };

async function getStartErrorMessage(response: Response): Promise<string> {
  if (response.status === 429) {
    return SSO_RATE_LIMITED_MESSAGE;
  }

  const errorType = await response
    .json()
    .then((body) => {
      const parsed = SsoErrorResponseSchema.safeParse(body);
      return parsed.success ? parsed.data.errorType || parsed.data.data?.errorType : undefined;
    })
    .catch(() => undefined);

  return errorType && SSO_UNAVAILABLE_ERROR_TYPES.has(errorType) ? SSO_UNAVAILABLE_MESSAGE : SSO_UNKNOWN_ERROR_MESSAGE;
}

interface UseSsoLoginOptions {
  csrfToken: string;
  returnUrl?: Maybe<string>;
}

/**
 * SSO discovery and login for the login/sign-up form. Discovery is best-effort so that an
 * unavailable or rate limited endpoint falls back to the other login options, but starting
 * a login the user explicitly asked for always reports a failure back to them.
 */
export function useSsoLogin({ csrfToken, returnUrl }: UseSsoLoginOptions) {
  const [isCheckingSso, setIsCheckingSso] = useState(false);
  const [isStartingSso, setIsStartingSso] = useState(false);
  const [ssoError, setSsoError] = useState<string | null>(null);
  const isStartingSsoRef = useRef(false);

  const clearSsoError = useCallback(() => setSsoError(null), []);

  const discoverSso = useCallback(
    async (email: string): Promise<boolean> => {
      if (!email || !email.includes('@')) {
        return false;
      }

      setIsCheckingSso(true);
      setSsoError(null);
      try {
        const response = await fetch(ROUTES.AUTH.api_sso_discover, {
          method: 'POST',
          headers: JSON_HEADERS,
          body: JSON.stringify({ email, csrfToken }),
        });

        if (!response.ok) {
          return false;
        }

        const { data } = SsoDiscoveryResponseSchema.parse(await response.json());
        return data.available;
      } catch (ex) {
        console.error('Error discovering SSO', ex);
        return false;
      } finally {
        setIsCheckingSso(false);
      }
    },
    [csrfToken],
  );

  /** Redirects to the identity provider, otherwise sets `ssoError` and resolves false */
  const startSsoLogin = useCallback(
    async (email: string): Promise<boolean> => {
      // Guards against a second start overwriting the single-valued PKCE/state/nonce cookies the
      // first one just set, which fails OIDC state validation after a full round trip to the
      // provider. A ref rather than `isStartingSso` because callers can re-enter within a render.
      if (isStartingSsoRef.current) {
        return false;
      }
      isStartingSsoRef.current = true;

      setIsStartingSso(true);
      setSsoError(null);
      try {
        const url = new URL(ROUTES.AUTH.api_sso_start, window.location.origin);
        if (returnUrl) {
          url.searchParams.set('returnUrl', returnUrl);
        }

        const response = await fetch(url.toString(), {
          method: 'POST',
          headers: JSON_HEADERS,
          body: JSON.stringify({ email, csrfToken }),
        });

        if (!response.ok) {
          setSsoError(await getStartErrorMessage(response));
          isStartingSsoRef.current = false;
          setIsStartingSso(false);
          return false;
        }

        const { data } = SsoStartResponseSchema.parse(await response.json());

        // The "last used" marker is deliberately not written here - the identity provider has not
        // seen the user yet, and it now decides whether the whole login form is replaced by the SSO
        // screen. The API sets it on the callback once the login actually succeeded.

        // Intentionally stays in the starting state, the browser is navigating away
        window.location.href = data.redirectUrl;
        return true;
      } catch (ex) {
        console.error('Error starting SSO login', ex);
        setSsoError(SSO_UNKNOWN_ERROR_MESSAGE);
        isStartingSsoRef.current = false;
        setIsStartingSso(false);
        return false;
      }
    },
    [csrfToken, returnUrl],
  );

  return { discoverSso, startSsoLogin, isCheckingSso, isStartingSso, ssoError, clearSsoError };
}
