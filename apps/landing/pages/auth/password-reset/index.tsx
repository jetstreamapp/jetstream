import Alert from '../../../components/Alert';
import { PasswordResetInit } from '../../../components/auth/PasswordResetInit';
import Layout from '../../../components/layouts/Layout';
import { useCsrfToken } from '../../../hooks/auth.hooks';
import { SIGN_IN_ERRORS } from '../../../utils/environment';

export default function Page() {
  const { csrfToken, csrfTokenError: error, isLoadingCsrfToken: isLoading } = useCsrfToken();

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

  return <PasswordResetInit csrfToken={csrfToken} />;
}

Page.getLayout = function getLayout(page) {
  return (
    <Layout title="Forgot Password | Jetstream" omitFooter omitNavigation>
      {page}
    </Layout>
  );
};
