import { TwoFactorType } from '@jetstream/auth/types';
import { Maybe } from '@jetstream/types';
import { useEffect, useState } from 'react';
import { AUTH_PATHS } from '../utils/environment';

interface AuthState {
  isLoggedIn: boolean;
  /**
   * Used to show user which email address the 2fa was sent to
   * in case there was a typo, the user can identify it
   */
  email?: Maybe<string>;
  pendingVerifications: Array<TwoFactorType> | false;
  isVerificationExpired: boolean;
}

export function useUserProfile() {
  const [authState, setAuthState] = useState<AuthState>({
    isLoggedIn: false,
    pendingVerifications: false,
    isVerificationExpired: false,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch(AUTH_PATHS.api_session, {
      headers: {
        Accept: 'application/json',
      },
    })
      .then((response) => {
        if (response.ok) {
          return response.json();
        }
        throw new Error('Unable to fetch user');
      })
      .then(
        ({
          data,
        }: {
          data: {
            isLoggedIn: boolean;
            pendingVerifications: TwoFactorType[] | false;
            isVerificationExpired: boolean;
          };
        }) => {
          setAuthState(data);
          setIsLoading(false);
        }
      )
      .catch((error) => {
        setIsLoading(false);
      });
  }, []);

  return {
    ...authState,
    isLoading,
  };
}

export function useCsrfToken() {
  const [isLoadingCsrfToken, setIsLoadingCsrfToken] = useState(true);
  const [csrfToken, setCsrfToken] = useState<string>();
  const [csrfTokenError, setCsrfTokenError] = useState<string>();

  useEffect(() => {
    setIsLoadingCsrfToken(true);
    fetch(AUTH_PATHS.api_csrf)
      .then((response) => {
        if (response.ok) {
          return response.json();
        }
        throw new Error('Unable to fetch csrf token');
      })
      .then(({ data }: { data: { csrfToken: string } }) => {
        setCsrfToken(data.csrfToken);
      })
      .catch((error) => {
        setCsrfTokenError(error?.message ?? 'Unable to initialize the form');
      })
      .finally(() => {
        setIsLoadingCsrfToken(false);
      });
  }, []);

  return {
    isLoadingCsrfToken,
    csrfToken,
    csrfTokenError,
  };
}
