import { useSearchParams } from 'next/navigation';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import Alert from '../../../../components/Alert';
import { PasswordResetVerify } from '../../../../components/auth/PasswordResetVerify';
import Layout from '../../../../components/layouts/Layout';
import { useCsrfToken } from '../../../../hooks/auth.hooks';
import { ROUTES, SIGN_IN_ERRORS } from '../../../../utils/environment';

export default function Page() {
  const router = useRouter();
  const { csrfToken, csrfTokenError: error, isLoadingCsrfToken: isLoading } = useCsrfToken();

  const searchParams = useSearchParams();

  const email = searchParams.get('email') || '';
  const token = searchParams.get('code') || '';

  useEffect(() => {
    if (isLoading) {
      return;
    }
    if (!email || !token) {
      router.push(`${ROUTES.AUTH.login}?error=InvalidOrExpiredResetToken`);
    }
  }, [token, email, isLoading, router]);

  if (error) {
    return (
      <div className="flex min-h-full flex-1 flex-col justify-center px-6 py-12 lg:px-8">
        <Alert message={SIGN_IN_ERRORS[error] ?? SIGN_IN_ERRORS.default} />
      </div>
    );
  }

  // TODO: show loading indicator here instead
  if (isLoading || !csrfToken) {
    return null;
  }

  return <PasswordResetVerify csrfToken={csrfToken} email={email} token={token} />;
}

Page.getLayout = function getLayout(page) {
  return (
    <Layout title="Forgot Password | Jetstream" omitFooter omitNavigation>
      {page}
    </Layout>
  );
};
