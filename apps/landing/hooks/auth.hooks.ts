import { OtpEnrollmentData, TwoFactorType } from '@jetstream/auth/types';
import { Maybe } from '@jetstream/types';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useState } from 'react';
import { ROUTES } from '../utils/environment';

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
    fetch(ROUTES.AUTH.api_session, {
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
    fetch(ROUTES.AUTH.api_csrf)
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

export function useOtpEnrollment(isLoadingInitial = true) {
  const router = useRouter();
  const [otp2fa, setOtp2fa] = useState<OtpEnrollmentData>();

  const [isLoading, setIsLoading] = useState(isLoadingInitial);
  const [error, setError] = useState<string>();

  const fetchEnrollmentData = useCallback(() => {
    setIsLoading(true);
    fetch(ROUTES.AUTH.api_otp_enroll, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
    })
      .then((response) => {
        if (response.ok) {
          return response.json();
        }
        router.push(ROUTES.AUTH.login);
      })
      .then(({ data }: { data: OtpEnrollmentData }) => {
        setOtp2fa(data);
      })
      .catch((error) => {
        setError(error?.message ?? 'Unable to initialize the form');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [router]);

  const submitEnrollmentData = useCallback(async (csrfToken: string, secretToken: string, code: string) => {
    const response = await fetch(ROUTES.AUTH.api_otp_enroll, {
      method: 'POST',
      body: new URLSearchParams({ csrfToken, secretToken, code }).toString(),
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
    });
    if (response.ok) {
      return response.json();
    }
    return response
      .json()
      .then((response) => {
        throw new Error(response.errorType || 'InvalidVerificationToken');
      })
      .catch((error) => {
        throw new Error('InvalidVerificationToken');
      });
  }, []);

  return {
    isLoading,
    otp2fa,
    error,
    fetchEnrollmentData,
    submitEnrollmentData,
  };
}
