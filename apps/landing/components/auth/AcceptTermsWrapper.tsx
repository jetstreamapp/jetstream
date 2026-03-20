import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { useCsrfToken, useUserProfile } from '../../hooks/auth.hooks';
import { ENVIRONMENT, ROUTES } from '../../utils/environment';
import { AcceptTerms } from './AcceptTerms';

export function AcceptTermsWrapper() {
  const router = useRouter();
  const { isLoading, pendingTosAcceptance, isLoggedIn, currentTosVersion } = useUserProfile();
  const { csrfToken, isLoadingCsrfToken } = useCsrfToken();

  useEffect(() => {
    if (isLoading) {
      return;
    }
    if (isLoggedIn && !pendingTosAcceptance) {
      // User is fully logged in with ToS accepted — redirect to app
      window.location.href = ENVIRONMENT.CLIENT_URL;
    } else if (!pendingTosAcceptance && !isLoggedIn) {
      // No pending acceptance and not logged in — redirect to login
      router.push(ROUTES.AUTH.login);
    }
  }, [isLoading, isLoggedIn, pendingTosAcceptance, router]);

  if (isLoading || isLoadingCsrfToken || !csrfToken || !pendingTosAcceptance) {
    return null;
  }

  return <AcceptTerms csrfToken={csrfToken} currentTosVersion={currentTosVersion} />;
}
