import { Providers } from '@jetstream/auth/types';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import { useCsrfToken, useUserProfile } from '../../hooks/auth.hooks';
import { ENVIRONMENT, ROUTES, SIGN_IN_ERRORS } from '../../utils/environment';
import Alert from '../Alert';
import { LoginOrSignUp } from './LoginOrSignUp';

interface LoginOrSignUpWrapperProps {
  action: 'login' | 'register';
}

export function LoginOrSignUpWrapper({ action }: LoginOrSignUpWrapperProps) {
  const router = useRouter();
  const [providers, setProviders] = useState<Providers>();
  const [error, setError] = useState<string>();
  const { isLoading, pendingVerifications, isLoggedIn } = useUserProfile();
  const { csrfToken, csrfTokenError } = useCsrfToken();

  useEffect(() => {
    if (isLoggedIn && (!pendingVerifications || !pendingVerifications.length)) {
      window.location.href = ENVIRONMENT.CLIENT_URL;
    } else if (pendingVerifications) {
      router.push(`${ROUTES.AUTH.verify}`);
    }
  }, [isLoggedIn, pendingVerifications, router]);

  useEffect(() => {
    fetch(ROUTES.AUTH.api_providers)
      .then((response) => {
        if (response.ok) {
          return response.json();
        }
        throw new Error('Unable to fetch providers');
      })
      .then(({ data }: { data: Providers }) => {
        setProviders(data);
      })
      .catch((error) => {
        console.error('Error fetching providers', error);
        setError(error?.message ?? 'Unable to initialize the form');
      });
  }, []);

  const resolvedError = error || csrfTokenError;
  if (resolvedError) {
    return (
      <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
        <Alert message={SIGN_IN_ERRORS[resolvedError] ?? SIGN_IN_ERRORS.default} />
      </div>
    );
  }

  // TODO: show loading indicator here instead
  if (isLoading || !csrfToken || !providers) {
    return null;
  }

  return <LoginOrSignUp action={action} csrfToken={csrfToken} providers={providers} />;
}
