import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { useCsrfToken, useUserProfile } from '../../hooks/auth.hooks';
import { AUTH_PATHS, ENVIRONMENT, SIGN_IN_ERRORS } from '../../utils/environment';
import Alert from '../Alert';
import { VerifyEmailOr2fa } from './VerifyEmailOr2fa';

export function VerifyEmailOr2faWrapper() {
  const router = useRouter();
  const { isLoading, isVerificationExpired, pendingVerifications, isLoggedIn } = useUserProfile();
  const { csrfToken, csrfTokenError: error } = useCsrfToken();

  useEffect(() => {
    if (isLoading) {
      return;
    }
    if (isLoggedIn && (!pendingVerifications || !pendingVerifications?.length)) {
      // user is logged in and has no pending verification
      window.location.href = ENVIRONMENT.CLIENT_URL;
    } else if (!pendingVerifications || !pendingVerifications?.length || isVerificationExpired) {
      // user is not logged in and has no pending verification
      router.push(`${AUTH_PATHS.login}`);
    }
  }, [isLoading, isLoggedIn, isVerificationExpired, pendingVerifications, router]);

  if (error) {
    return (
      <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
        <Alert message={SIGN_IN_ERRORS[error] ?? SIGN_IN_ERRORS.default} />
      </div>
    );
  }

  // TODO: show loading indicator here instead
  if (isLoading || !csrfToken || !pendingVerifications) {
    return null;
  }

  return <VerifyEmailOr2fa csrfToken={csrfToken} pendingVerifications={pendingVerifications} />;
}
